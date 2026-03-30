import {Hono} from 'hono';
import {ServerOptions} from '../types.js';
import {setup} from '../setup.js';
import {Env} from '../env.js';
import {
	createWalletClient,
	http,
	isAddress,
	parseEther,
	type Hex,
	type Address,
} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';

const PROSOPO_VERIFY_ENDPOINT = 'https://api.prosopo.io/siteverify';

type VerifyResponse = {
	verified: boolean;
	[key: string]: unknown;
};

type ClaimRequest = {
	token: string;
	chainId: string;
	address: string;
};

async function verifyProsopoCaptcha(
	token: string,
	secret: string,
): Promise<boolean> {
	const body = {
		token,
		secret,
	};

	const response = await fetch(PROSOPO_VERIFY_ENDPOINT, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	const result = (await response.json()) as VerifyResponse;
	return result.verified === true;
}

function parseChainConfig(
	configValue: string,
): {amount: string; rpcUrl: string} | null {
	// Format: <amount>:<rpc_endpoint>
	const colonIndex = configValue.indexOf(':');
	if (colonIndex === -1) {
		return null;
	}
	const amount = configValue.substring(0, colonIndex);
	const rpcUrl = configValue.substring(colonIndex + 1);
	if (!amount || !rpcUrl) {
		return null;
	}
	return {amount, rpcUrl};
}

export function getAPI<CustomEnv extends Env>(
	options: ServerOptions<CustomEnv>,
) {
	const app = new Hono<{Bindings: CustomEnv}>()
		.use(setup({serverOptions: options}))
		.post('/claim', async (c) => {
			const config = c.get('config');
			const env = config.env;

			// Check if captcha is disabled (for localhost development)
			const captchaDisabled = env.DISABLE_CAPTCHA === 'true';

			// Validate PROSOPO secret (only required if captcha is enabled)
			const secret = env.PROSOPO_SITE_PRIVATE_KEY;
			if (!captchaDisabled && !secret) {
				return c.json({error: 'PROSOPO_SITE_PRIVATE_KEY not configured'}, 500);
			}

			// Validate FAUCET_PRIVATE_KEY
			const faucetPrivateKey = env.FAUCET_PRIVATE_KEY;
			if (!faucetPrivateKey) {
				return c.json({error: 'FAUCET_PRIVATE_KEY not configured'}, 500);
			}

			const body = await c.req.json<ClaimRequest>();
			const {token, chainId, address} = body;

			// Validate required fields
			if (!token) {
				return c.json({error: 'Missing token'}, 400);
			}

			if (!chainId) {
				return c.json({error: 'Missing chainId'}, 400);
			}

			if (!address) {
				return c.json({error: 'Missing address'}, 400);
			}

			// Validate address format
			if (!isAddress(address)) {
				return c.json({error: 'Invalid Ethereum address'}, 400);
			}

			// Parse chainId
			const chainIdNum = parseInt(chainId, 10);
			if (isNaN(chainIdNum) || chainIdNum <= 0) {
				return c.json({error: 'Invalid chainId'}, 400);
			}

			// Check for chain-specific config (format: <amount>:<rpc_endpoint>)
			const chainConfigKey = `CHAIN_${chainId}` as `CHAIN_${string}`;
			const chainConfigValue = env[chainConfigKey];

			if (!chainConfigValue) {
				return c.json(
					{error: `Faucet not configured for chain ${chainId}`},
					400,
				);
			}

			const chainConfig = parseChainConfig(chainConfigValue);
			if (!chainConfig) {
				return c.json(
					{
						error: `Invalid chain config format for chain ${chainId}. Expected: <amount>:<rpc_endpoint>`,
					},
					500,
				);
			}

			// Verify captcha (skip if disabled for localhost development)
			if (!captchaDisabled) {
				const verified = await verifyProsopoCaptcha(token, secret!);

				if (!verified) {
					return c.json({error: 'Captcha verification failed'}, 401);
				}
			}

			try {
				// Create wallet client and send transaction
				const account = privateKeyToAccount(faucetPrivateKey as Hex);
				const {amount, rpcUrl} = chainConfig;

				const walletClient = createWalletClient({
					account,
					chain: {
						id: chainIdNum,
						name: `Chain ${chainIdNum}`,
						nativeCurrency: {name: 'ETH', symbol: 'ETH', decimals: 18},
						rpcUrls: {
							default: {http: [rpcUrl]},
						},
					},
					transport: http(rpcUrl),
				});

				const txHash = await walletClient.sendTransaction({
					to: address as Address,
					value: BigInt(amount),
				});

				return c.json({success: true, txHash});
			} catch (err) {
				console.error('Transaction error:', err);
				const errorMessage =
					err instanceof Error ? err.message : 'Transaction failed';
				return c.json({error: errorMessage}, 500);
			}
		});

	return app;
}
