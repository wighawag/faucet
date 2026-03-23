import {Hono} from 'hono';
import {ServerOptions} from '../types.js';
import {setup} from '../setup.js';
import {Env} from '../env.js';

const PROSOPO_VERIFY_ENDPOINT = 'https://api.prosopo.io/siteverify';

type VerifyResponse = {
	verified: boolean;
	[key: string]: unknown;
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

export function getAPI<CustomEnv extends Env>(
	options: ServerOptions<CustomEnv>,
) {
	const app = new Hono<{Bindings: CustomEnv}>()
		.use(setup({serverOptions: options}))
		.post('/claim', async (c) => {
			const config = c.get('config');
			const env = config.env;

			const secret = env.PROSOPO_SITE_PRIVATE_KEY;
			if (!secret) {
				return c.json({error: 'PROSOPO_SITE_PRIVATE_KEY not configured'}, 500);
			}

			const body = await c.req.json<{token: string}>();
			const token = body.token;

			if (!token) {
				return c.json({error: 'Missing token'}, 400);
			}

			const verified = await verifyProsopoCaptcha(token, secret);

			if (verified) {
				return c.text('hello world');
			} else {
				return c.json({error: 'Captcha verification failed'}, 401);
			}
		});

	return app;
}
