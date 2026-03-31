<script lang="ts">
	import {ProcaptchaComponent} from '@prosopo/svelte-procaptcha-wrapper';
	import {createPublicClient, http, type Hex} from 'viem';
	import {Button} from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';

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
				err instanceof Error ? err.message : 'Failed to confirm transaction';
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

<div class="min-h-screen bg-background flex items-center justify-center p-4">
	<Card.Root class="w-full max-w-md">
		<Card.Header class="text-center">
			<Card.Title class="text-2xl">Faucet</Card.Title>
			<Card.Description>Request testnet tokens</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			{#if missingParams}
				<Alert.Root variant="warning">
					<Alert.Title>Missing Parameters</Alert.Title>
					<Alert.Description>
						<p>Please provide both <code class="rounded bg-muted px-1 py-0.5 font-mono text-sm">chainId</code> and <code class="rounded bg-muted px-1 py-0.5 font-mono text-sm">address</code> in the URL.</p>
						<p class="mt-2 text-xs">Example: <code class="rounded bg-muted px-1 py-0.5 font-mono">?chainId=11155111&address=0x...</code></p>
					</Alert.Description>
				</Alert.Root>
			{:else if !configLoaded}
				<div class="flex items-center justify-center py-8">
					<div class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
				</div>
			{:else}
				<div class="space-y-2 rounded-lg bg-muted p-4">
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Chain ID</span>
						<span class="font-medium">{chainId}</span>
					</div>
					<div class="flex items-center justify-between text-sm">
						<span class="text-muted-foreground">Recipient</span>
						<code class="max-w-[200px] truncate rounded bg-background px-2 py-1 font-mono text-xs">{address}</code>
					</div>
				</div>

				{#if forceError}
					<Alert.Root variant="destructive">
						<Alert.Title>Test Mode</Alert.Title>
						<Alert.Description>forceError=true (transaction will fail)</Alert.Description>
					</Alert.Root>
				{/if}

				{#if captchaDisabled}
					<Alert.Root variant="warning">
						<Alert.Title>Development Mode</Alert.Title>
						<Alert.Description>Captcha disabled for local development</Alert.Description>
					</Alert.Root>
				{:else}
					<div class="flex justify-center">
						<ProcaptchaComponent
							{siteKey}
							language="en"
							callback={handleCaptchaVerification}
							htmlAttributes={{class: 'my-app__procaptcha'}}
						/>
					</div>
				{/if}

				{#if hasFatalError}
					{#if error}
						<Alert.Root variant="destructive">
							<Alert.Title>Error</Alert.Title>
							<Alert.Description>{error}</Alert.Description>
						</Alert.Root>
					{/if}
					<Button onclick={handleClose} variant="secondary" class="w-full">
						Close
					</Button>
				{:else}
					<Button
						onclick={handleSubmit}
						disabled={isLoading || isPendingConfirmation || !captchaToken}
						class="w-full"
					>
						{#if isLoading}
							<span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></span>
							Sending...
						{:else}
							Claim Funds
						{/if}
					</Button>

					{#if txHash}
						<div class="space-y-3 rounded-lg border bg-card p-4">
							<div class="space-y-1">
								<span class="text-sm font-medium text-muted-foreground">Transaction Hash</span>
								<code class="block break-all rounded bg-muted p-2 font-mono text-xs">{txHash}</code>
							</div>
							{#if isPendingConfirmation}
								<div class="flex items-center gap-2 text-amber-600">
									<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
									<span class="text-sm">Waiting for confirmation...</span>
								</div>
							{:else if confirmations > 0}
								<Alert.Root variant="success">
									<Alert.Title>Success</Alert.Title>
									<Alert.Description>
										Transaction confirmed!
										{#if window.opener}
											<span class="block text-xs opacity-75">Closing window...</span>
										{/if}
									</Alert.Description>
								</Alert.Root>
							{/if}
						</div>
					{:else if result && !txHash}
						<Alert.Root variant="success">
							<Alert.Description>{result}</Alert.Description>
						</Alert.Root>
					{/if}

					{#if error && !hasFatalError}
						<Alert.Root variant="destructive">
							<Alert.Title>Error</Alert.Title>
							<Alert.Description>{error}</Alert.Description>
						</Alert.Root>
					{/if}
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
