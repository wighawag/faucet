<script lang="ts">
	import {ProcaptchaComponent} from '@prosopo/svelte-procaptcha-wrapper';

	const siteKey = import.meta.env.VITE_PROSOPO_SITE_KEY;
	let captchaToken = '';
	let result = '';
	let error = '';
	let isLoading = false;

	const handleCaptchaVerification = (token: string): void => {
		console.log('captcha verified', token);
		captchaToken = token;
		result = '';
		error = '';
	};

	const handleSubmit = async (): Promise<void> => {
		if (!captchaToken) {
			error = 'Please complete the captcha first';
			return;
		}

		isLoading = true;
		result = '';
		error = '';

		try {
			const response = await fetch('/api/claim', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({token: captchaToken}),
			});

			if (response.ok) {
				result = await response.text();
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Verification failed';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Unknown error';
		} finally {
			isLoading = false;
		}
	};
</script>

<ProcaptchaComponent
	{siteKey}
	language="en"
	callback={handleCaptchaVerification}
	htmlAttributes={{class: 'my-app__procaptcha'}}
/>

<button onclick={handleSubmit} disabled={isLoading || !captchaToken}>
	{isLoading ? 'Verifying...' : 'Submit'}
</button>

{#if result}
	<p class="success">{result}</p>
{/if}

{#if error}
	<p class="error">{error}</p>
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
</style>
