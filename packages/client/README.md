# faucet-client

A simple client library to interact with faucet popups.

## Installation

```bash
npm install faucet-client
# or
pnpm add faucet-client
# or
yarn add faucet-client
```

## Usage

```typescript
import { claimFund } from "faucet-client";

try {
  const txHash = await claimFund({
    faucetUrl: "https://faucet.example.com",
    chainId: 11155111,
    address: "0x...",
  });
  console.log("Transaction confirmed:", txHash);
} catch (error) {
  console.error("Faucet claim failed:", error.message);
}
```

## API

### `claimFund(params, options?): Promise<Hex>`

Opens the faucet in a popup window and waits for the transaction to be confirmed.

#### Parameters

- `params` - Required faucet parameters:
  - `faucetUrl` - Base URL of the faucet (e.g., 'https://faucet.example.com')
  - `chainId` - Chain ID to claim funds on (string or number)
  - `address` - Recipient address

- `options` - Optional configuration:
  - `width` - Popup window width (default: 500)
  - `height` - Popup window height (default: 600)
  - `timeout` - Optional timeout in milliseconds (no timeout by default)
  - `forceError` - Force an error for testing purposes (default: false)

#### Returns

Promise that resolves with the transaction hash (`0x${string}`) on success.

#### Throws

- `Error` if the popup is blocked
- `Error` if the popup is closed before completion
- `Error` if the transaction fails
- `Error` if the claim times out (only if timeout is set)

## Testing Error Handling

Use the `forceError` option to test error handling without making real transactions:

```typescript
try {
  await claimFund(
    {
      faucetUrl: "https://faucet.example.com",
      chainId: 11155111,
      address: "0x...",
    },
    { forceError: true },
  );
} catch (error) {
  console.log("Error handling works:", error.message);
  // "Simulated transaction failure (forceError=true)"
}
```
