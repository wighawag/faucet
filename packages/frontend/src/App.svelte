<script lang="ts">
	let message = $state('Click the button to fetch data from the API');
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function fetchData() {
		loading = true;
		error = null;
		try {
			const response = await fetch('/api/');
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			message = await response.text();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
			message = 'Failed to fetch data';
		} finally {
			loading = false;
		}
	}
</script>

<main>
	<h1>Faucet</h1>

	<div class="card">
		<button onclick={fetchData} disabled={loading}>
			{loading ? 'Loading...' : 'Fetch API Data'}
		</button>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{/if}

	<pre class="response">{message}</pre>
</main>

<style>
	:global(body) {
		margin: 0;
		font-family:
			system-ui,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif;
		background: #1a1a2e;
		color: #eee;
		min-height: 100vh;
	}

	main {
		padding: 2rem;
		max-width: 800px;
		margin: 0 auto;
		text-align: center;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 2rem;
		color: #fff;
	}

	.card {
		padding: 1.5rem;
		background: #16213e;
		border-radius: 8px;
		margin-bottom: 1rem;
	}

	button {
		padding: 0.75rem 1.5rem;
		font-size: 1rem;
		cursor: pointer;
		background: #0f3460;
		color: #fff;
		border: none;
		border-radius: 4px;
		transition: background 0.2s;
	}

	button:hover:not(:disabled) {
		background: #1a5490;
	}

	button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.error {
		color: #e94560;
		margin: 1rem 0;
	}

	.response {
		text-align: left;
		background: #0f0f23;
		padding: 1rem;
		border-radius: 4px;
		overflow-x: auto;
		font-family: 'Fira Code', 'Consolas', monospace;
		font-size: 0.9rem;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
