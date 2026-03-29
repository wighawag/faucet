# Faucet Server

A configurable EVM faucet server that dispenses testnet/devnet tokens with Prosopo captcha protection. Supports multiple chains and deploys to Cloudflare Workers or Node.js.

## Quick Start

Run a local faucet server with a single command:

```bash
npx faucet-server serve --port 3000
```

Or install globally:

```bash
npm install -g faucet-server
serve --port 3000
```

**Configure via environment variables:**

```bash
# Required: Prosopo captcha keys (get from https://prosopo.io/)
export PROSOPO_SITE_PRIVATE_KEY=your_secret_key
export VITE_PROSOPO_SITE_KEY=your_site_key

# Required: Wallet with funds to dispense
export FAUCET_PRIVATE_KEY=0x...your_wallet_private_key

# Required: Configure chains (format: amount_in_wei:rpc_endpoint)
export CHAIN_31337=10000000000000000:http://localhost:8545
export CHAIN_11155111=10000000000000000:https://eth-sepolia.g.alchemy.com/v2/KEY
```

Then access the faucet at: `http://localhost:3000?chainId=31337&address=0x...`

## Features

- 🔗 **Multi-chain support** — Configure any EVM chain via environment variables
- 🤖 **Bot protection** — Integrated [Prosopo](https://prosopo.io/) captcha verification
- 🚀 **Multiple deployment targets** — Cloudflare Workers or Node.js
- ⚡ **Modern stack** — Svelte frontend, Hono API server, Viem for transactions
- 📦 **Monorepo architecture** — Clean separation of frontend, server, and platform concerns

---

## Development

Want to contribute or customize the faucet? Follow the development setup below.

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [pnpm](https://pnpm.io/) >= 8
- A Prosopo account with site keys ([sign up](https://prosopo.io/))
- An EVM wallet with funds for the faucet

### Installation

```bash
# Clone the repository
git clone https://github.com/wighawag/faucet.git
cd faucet

# Install dependencies
pnpm install
```

### Configuration

#### Environment Variables

The faucet requires configuration via environment variables. Copy the example files and fill in your values:

**Frontend** ([`packages/frontend/.env`](packages/frontend/.env)):
```bash
VITE_PROSOPO_SITE_KEY=your_prosopo_site_key
```

**Server** (choose your platform):

For Node.js ([`platforms/nodejs/.env`](platforms/nodejs/.env)):
```bash
PROSOPO_SITE_PRIVATE_KEY=your_prosopo_secret_key
FAUCET_PRIVATE_KEY=0x...your_wallet_private_key
CHAIN_31337=10000000000000000:http://localhost:8545
```

For Cloudflare Workers ([`platforms/cf-worker/.dev.vars`](platforms/cf-worker/.dev.vars.default)):
```bash
PROSOPO_SITE_PRIVATE_KEY=your_prosopo_secret_key
FAUCET_PRIVATE_KEY=0x...your_wallet_private_key
CHAIN_31337=10000000000000000:http://localhost:8545
```

#### Chain Configuration

Chains are configured using the `CHAIN_<CHAIN_ID>` environment variable format:

```
CHAIN_<CHAIN_ID>=<amount_in_wei>:<rpc_endpoint>
```

**Examples:**
```bash
# Local development (anvil/hardhat)
CHAIN_31337=10000000000000000:http://localhost:8545

# Sepolia testnet (0.01 ETH)
CHAIN_11155111=10000000000000000:https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY

# Multiple chains
CHAIN_421614=10000000000000000:https://sepolia-rollup.arbitrum.io/rpc
```

### Running Locally

Start the full development environment using Zellij:

```bash
pnpm start
```

Or run individual services:

```bash
# Frontend only
pnpm frontend:dev

# Server only (Node.js)
pnpm nodejs:dev

# Server only (Cloudflare Workers)
pnpm cf-worker:dev
```

### Building

```bash
# Build everything
pnpm build

# Build frontend only
pnpm build:frontend

# Build server only
pnpm build:server
```

### Deployment

#### Cloudflare Workers

1. Configure your [`wrangler.toml`](platforms/cf-worker/wrangler.toml)
2. Set secrets in Cloudflare dashboard or via CLI:
   ```bash
   wrangler secret put PROSOPO_SITE_PRIVATE_KEY
   wrangler secret put FAUCET_PRIVATE_KEY
   ```
3. Deploy:
   ```bash
   pnpm deploy:cf
   ```

#### Node.js

Build and run the Node.js server:

```bash
pnpm build
cd platforms/nodejs
node dist/cli.js
```

---

## Usage

Users access the faucet via URL with query parameters:

```
https://your-faucet.example.com?chainId=11155111&address=0x...
```

**Query Parameters:**
| Parameter | Description | Example |
|-----------|-------------|---------|
| `chainId` | Target chain ID | `11155111` (Sepolia) |
| `address` | Recipient wallet address | `0x742d35Cc6634C0532925a3b844Bc9e7595f...` |

## API Reference

### POST `/api/claim`

Request funds from the faucet.

**Request Body:**
```json
{
  "token": "prosopo_captcha_token",
  "chainId": "11155111",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f..."
}
```

**Success Response:**
```json
{
  "success": true,
  "txHash": "0x..."
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

## Project Structure

```
faucet/
├── packages/
│   ├── frontend/          # Svelte SPA with captcha integration
│   └── server/            # Hono API server (platform-agnostic)
├── platforms/
│   ├── cf-worker/         # Cloudflare Workers deployment
│   └── nodejs/            # Node.js deployment
└── package.json           # Root workspace config
```

## Tech Stack

- **Frontend:** [Svelte](https://svelte.dev/), [Vite](https://vitejs.dev/)
- **Server:** [Hono](https://hono.dev/)
- **Blockchain:** [Viem](https://viem.sh/)
- **Captcha:** [Prosopo](https://prosopo.io/)
- **Monorepo:** [pnpm workspaces](https://pnpm.io/workspaces)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)
