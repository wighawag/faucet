export type Hex = `0x${string}`;

export interface ClaimFundParams {
	/**
	 * Base URL of the faucet (e.g., 'https://faucet.example.com')
	 */
	faucetUrl: string;
	/**
	 * Chain ID to claim funds on
	 */
	chainId: string | number;
	/**
	 * Recipient address
	 */
	address: string;
}

export interface ClaimFundOptions {
	/**
	 * Popup window width (default: 500)
	 */
	width?: number;
	/**
	 * Popup window height (default: 600)
	 */
	height?: number;
	/**
	 * Optional timeout in milliseconds. If not provided, the popup will stay open indefinitely
	 * until the user completes the claim or closes the popup.
	 */
	timeout?: number;
	/**
	 * Force an error for testing purposes. When true, the faucet will simulate a failure
	 * without making any actual transactions.
	 */
	forceError?: boolean;
}

export interface FaucetSuccessMessage {
	type: 'faucet-success';
	txHash: Hex;
	chainId: string;
	address: string;
}

export interface FaucetErrorMessage {
	type: 'faucet-error';
	error: string;
}

export type FaucetMessage = FaucetSuccessMessage | FaucetErrorMessage;

function isFaucetMessage(data: unknown): data is FaucetMessage {
	if (typeof data !== 'object' || data === null) {
		return false;
	}
	const msg = data as Record<string, unknown>;
	return msg.type === 'faucet-success' || msg.type === 'faucet-error';
}

/**
 * Opens the faucet in a popup window and waits for the transaction to be confirmed.
 *
 * @param params - The faucet parameters (faucetUrl, chainId, address)
 * @param options - Optional configuration for the popup, timeout, and testing
 * @returns Promise that resolves with the transaction hash on success
 * @throws Error if the popup is blocked, closed without completing, or transaction fails
 *
 * @example
 * ```typescript
 * const txHash = await claimFund({
 *   faucetUrl: 'https://faucet.example.com',
 *   chainId: 11155111,
 *   address: '0x...',
 * });
 * console.log('Transaction confirmed:', txHash);
 * ```
 *
 * @example Testing error handling
 * ```typescript
 * try {
 *   await claimFund(
 *     { faucetUrl: 'https://faucet.example.com', chainId: 1, address: '0x...' },
 *     { forceError: true }
 *   );
 * } catch (error) {
 *   console.log('Error handling works:', error.message);
 * }
 * ```
 */
export function claimFund(
	params: ClaimFundParams,
	options: ClaimFundOptions = {},
): Promise<Hex> {
	const {faucetUrl, chainId, address} = params;
	const {width = 500, height = 600, timeout, forceError} = options;

	// Build the URL with query parameters
	const url = new URL(faucetUrl);
	url.searchParams.set('chainId', String(chainId));
	url.searchParams.set('address', address);
	if (forceError) {
		url.searchParams.set('forceError', 'true');
	}

	return new Promise((resolve, reject) => {
		// Calculate popup position (centered)
		const left = Math.max(0, (window.screen.width - width) / 2);
		const top = Math.max(0, (window.screen.height - height) / 2);

		// Open popup window
		const popup = window.open(
			url.toString(),
			'faucet-popup',
			`width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
		);

		if (!popup) {
			reject(new Error('Popup blocked. Please allow popups for this site.'));
			return;
		}

		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		let checkClosedInterval: ReturnType<typeof setInterval> | undefined;

		const cleanup = () => {
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = undefined;
			}
			if (checkClosedInterval) {
				clearInterval(checkClosedInterval);
				checkClosedInterval = undefined;
			}
			window.removeEventListener('message', handleMessage);
		};

		const handleMessage = (event: MessageEvent) => {
			// Only process messages from the popup
			if (event.source !== popup) {
				return;
			}

			if (!isFaucetMessage(event.data)) {
				return;
			}

			if (event.data.type === 'faucet-success') {
				cleanup();
				resolve(event.data.txHash);
			} else if (event.data.type === 'faucet-error') {
				cleanup();
				reject(new Error(event.data.error));
			}
		};

		window.addEventListener('message', handleMessage);

		// Check if popup is closed without completing
		checkClosedInterval = setInterval(() => {
			if (popup.closed) {
				cleanup();
				reject(new Error('Faucet popup was closed before completion'));
			}
		}, 500);

		// Optional timeout
		if (timeout !== undefined && timeout > 0) {
			timeoutId = setTimeout(() => {
				cleanup();
				if (!popup.closed) {
					popup.close();
				}
				reject(new Error('Faucet claim timed out'));
			}, timeout);
		}
	});
}
