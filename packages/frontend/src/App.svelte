<script lang="ts">
	import {ProcaptchaComponent} from '@prosopo/svelte-procaptcha-wrapper';
	import {createPublicClient, http, type Hex} from 'viem';

	const siteKey = import.meta.env.VITE_PROSOPO_SITE_KEY;

	// Fetch server config to check if captcha is disabled
	let captchaDisabled = false;
	let configLoaded = false;
	let captchaToken = '';
	let result = '';
	let txHash = '';
	let error = '';
	let isLoading = false;
	let isPendingConfirmation = false;
	let confirmations = 0;
	let hasFatalError = false; // When true, only close button is shown

	// Get chainId and address from URL query parameters
	const urlParams = new URLSearchParams(window.location.search);
	const chainId = urlParams.get('chainId') || '';
	const address = urlParams.get('address') || '';

	// Test mode: force an error (useful for testing error handling)
	const forceError = urlParams.get('forceError') === 'true';

	// Validate params on load
	const missingParams = !chainId || !address;

	// Load server config on mount
	async function loadConfig() {
		try {
			const response = await fetch('/api/config');
			const config = await response.json();
			captchaDisabled = config.captchaDisabled === true;
			// When captcha is disabled, set a dummy token to bypass validation
			if (captchaDisabled) {
				captchaToken = 'disabled';
			}
		} catch (err) {
			console.error('Failed to load config:', err);
		} finally {
			configLoaded = true;
		}
	}
	loadConfig();

	// Helper to notify opener of errors and mark as fatal
	function notifyError(errorMessage: string): void {
		hasFatalError = true;
		if (window.opener) {
			window.opener.postMessage(
				{
					type: 'faucet-error',
					error: errorMessage,
				},
				'*',
			);
		}
	}

	// Handle close button click
	function handleClose(): void {
		window.close();
	}

	const handleCaptchaVerification = (token: string): void => {
		console.log('captcha verified', token);
		captchaToken = token;
		result = '';
		txHash = '';
		error = '';
	};

	async function waitForConfirmation(hash: string): Promise<void> {
		isPendingConfirmation = true;
		confirmations = 0;

		try {
			// Fetch chain config to get RPC URL
			const chainResponse = await fetch(`/api/chain/${chainId}`);
			if (!chainResponse.ok) {
				throw new Error('Failed to get chain configuration');
			}
			const chainConfig = await chainResponse.json();

			const client = createPublicClient({
				chain: {
					id: parseInt(chainId, 10),
					name: `Chain ${chainId}`,
					nativeCurrency: {name: 'ETH', symbol: 'ETH', decimals: 18},
					rpcUrls: {
						default: {http: [chainConfig.rpcUrl]},
					},
				},
				transport: http(chainConfig.rpcUrl),
			});

			// Wait for transaction receipt with at least 1 confirmation
			const receipt = await client.waitForTransactionReceipt({
				hash: hash as Hex,
				confirmations: 1,
			});

			if (receipt.status === 'success') {
				confirmations = 1;
				result = 'Transaction confirmed!';

				// Notify opener window and close
				if (window.opener) {
					window.opener.postMessage(
						{
							type: 'faucet-success',
							txHash: hash,
							chainId,
							address,
						},
						'*',
					);
					// Small delay to ensure message is sent
					setTimeout(() => {
						window.close();
					}, 500);
				}
			} else {
				const errorMsg = 'Transaction failed on-chain';
				error = errorMsg;
				notifyError(errorMsg);
			}
		} catch (err) {
			const errorMsg =
				err instanceof Error
					? err.message
					: 'Failed to confirm transaction';
			error = errorMsg;
			notifyError(errorMsg);
		} finally {
			isPendingConfirmation = false;
		}
	}

	const handleSubmit = async (): Promise<void> => {
		if (!captchaToken) {
			error = 'Please complete the captcha first';
			return;
		}

		if (!chainId || !address) {
			error = 'Missing chainId or address in URL parameters';
			return;
		}

		isLoading = true;
		result = '';
		txHash = '';
		error = '';
		confirmations = 0;

		// Test mode: simulate a failure
		if (forceError) {
			// Simulate a brief delay for realism
			await new Promise((r) => setTimeout(r, 500));
			const errorMsg = 'Simulated transaction failure (forceError=true)';
			error = errorMsg;
			isLoading = false;
			notifyError(errorMsg);
			return;
		}

		try {
			const response = await fetch('/api/claim', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					token: captchaToken,
					chainId,
					address,
				}),
			});

			const data = await response.json();

			if (response.ok && data.success) {
				txHash = data.txHash;
				result = 'Transaction submitted, waiting for confirmation...';
				isLoading = false;

				// Wait for confirmation
				await waitForConfirmation(data.txHash);
			} else {
				const errorMsg = data.error || 'Claim failed';
				error = errorMsg;
				notifyError(errorMsg);
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Unknown error';
			error = errorMsg;
			notifyError(errorMsg);
		} finally {
			isLoading = false;
		}
	};
</script>

{#if missingParams}
	<div class="error-container">
		<p class="error">Missing required URL parameters.</p>
		<p>
			Please provide both <code>chainId</code> and <code>address</code> in the URL.
		</p>
		<p>Example: <code>?chainId=11155111&address=0x...</code></p>
	</div>
{:else if !configLoaded}
	<p class="loading">Loading...</p>
{:else}
	<div class="params-info">
		<p><strong>Chain ID:</strong> {chainId}</p>
		<p><strong>Recipient:</strong> <code>{address}</code></p>
	</div>

	{#if forceError}
		<p class="test-mode">⚠️ Test mode: forceError=true (transaction will fail)</p>
	{/if}

	{#if captchaDisabled}
		<p class="captcha-disabled">Captcha disabled for local development</p>
	{:else}
		<ProcaptchaComponent
			{siteKey}
			language="en"
			callback={handleCaptchaVerification}
			htmlAttributes={{class: 'my-app__procaptcha'}}
		/>
	{/if}

	{#if hasFatalError}
		{#if error}
			<div class="error-box">
				<p class="error">{error}</p>
			</div>
		{/if}
		<button class="close-button" onclick={handleClose}>Close</button>
	{:else}
		<button
			onclick={handleSubmit}
			disabled={isLoading || isPendingConfirmation || !captchaToken}
		>
			{isLoading ? 'Sending...' : 'Claim Funds'}
		</button>

		{#if txHash}
			<div class="tx-status">
				<p class="tx-hash">
					<strong>Transaction Hash:</strong>
					<code>{txHash}</code>
				</p>
				{#if isPendingConfirmation}
					<div class="pending">
						<span class="spinner"></span>
						<span>Waiting for confirmation...</span>
					</div>
				{:else if confirmations > 0}
					<p class="success">✓ Transaction confirmed!</p>
					{#if window.opener}
						<p class="closing">Closing window...</p>
					{/if}
				{/if}
			</div>
		{:else if result && !txHash}
			<p class="success">{result}</p>
		{/if}

		{#if error}
			<p class="error">{error}</p>
		{/if}
	{/if}
{/if}

<style>
	.success {
		color: green;
		font-weight: bold;
	}
	.error {
		color: red;
		font-weight: bold;
	}
	.error-container {
		padding: 1rem;
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 4px;
		margin-bottom: 1rem;
	}
	.params-info {
		padding: 1rem;
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		border-radius: 4px;
		margin-bottom: 1rem;
	}
	.params-info p {
		margin: 0.25rem 0;
	}
	.tx-hash {
		word-break: break-all;
		background: #f8f9fa;
		padding: 0.5rem;
		border-radius: 4px;
	}
	code {
		background: #e9ecef;
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-family: monospace;
	}
	button {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		font-size: 1rem;
		cursor: pointer;
	}
	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.captcha-disabled {
		padding: 0.75rem 1rem;
		background: #fff3cd;
		border: 1px solid #ffc107;
		border-radius: 4px;
		color: #856404;
		font-style: italic;
	}
	.test-mode {
		padding: 0.75rem 1rem;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
		color: #721c24;
		font-weight: bold;
		margin-bottom: 0.5rem;
	}
	.loading {
		color: #6c757d;
		font-style: italic;
	}
	.tx-status {
		margin-top: 1rem;
		padding: 1rem;
		background: #f8f9fa;
		border: 1px solid #dee2e6;
		border-radius: 4px;
	}
	.pending {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #856404;
		margin-top: 0.5rem;
	}
	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid #dee2e6;
		border-top-color: #007bff;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	.closing {
		color: #6c757d;
		font-style: italic;
		margin-top: 0.5rem;
	}
	.error-box {
		margin-top: 1rem;
		padding: 1rem;
		background: #f8d7da;
		border: 1px solid #f5c6cb;
		border-radius: 4px;
	}
	.error-box .error {
		margin: 0;
	}
	.close-button {
		margin-top: 1rem;
		padding: 0.5rem 1.5rem;
		font-size: 1rem;
		cursor: pointer;
		background: #6c757d;
		color: white;
		border: none;
		border-radius: 4px;
	}
	.close-button:hover {
		background: #5a6268;
	}
</style>
