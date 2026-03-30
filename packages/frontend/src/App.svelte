<script lang="ts">
	import {ProcaptchaComponent} from '@prosopo/svelte-procaptcha-wrapper';

	const siteKey = import.meta.env.VITE_PROSOPO_SITE_KEY;
	
	// Fetch server config to check if captcha is disabled
	let captchaDisabled = false;
	let configLoaded = false;
	let captchaToken = '';
	let result = '';
	let txHash = '';
	let error = '';
	let isLoading = false;

	// Get chainId and address from URL query parameters
	const urlParams = new URLSearchParams(window.location.search);
	const chainId = urlParams.get('chainId') || '';
	const address = urlParams.get('address') || '';

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

	const handleCaptchaVerification = (token: string): void => {
		console.log('captcha verified', token);
		captchaToken = token;
		result = '';
		txHash = '';
		error = '';
	};

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
				result = 'Funds sent successfully!';
				txHash = data.txHash;
			} else {
				error = data.error || 'Claim failed';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
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

	<button onclick={handleSubmit} disabled={isLoading || !captchaToken}>
		{isLoading ? 'Sending...' : 'Claim Funds'}
	</button>

	{#if result}
		<p class="success">{result}</p>
		{#if txHash}
			<p class="tx-hash">
				<strong>Transaction Hash:</strong>
				<code>{txHash}</code>
			</p>
		{/if}
	{/if}

	{#if error}
		<p class="error">{error}</p>
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
	.loading {
		color: #6c757d;
		font-style: italic;
	}
</style>
