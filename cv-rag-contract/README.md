# CV-RAG DocumentRegistry Smart Contract

Ethereum smart contract for anchoring document Merkle roots on-chain, enabling cryptographic verification of budget document integrity.

## Overview

The `DocumentRegistry` contract stores Merkle roots of budget documents on the Base Sepolia L2 blockchain. This enables:

- **Timestamping**: Blockchain provides immutable proof of when documents were registered
- **Tamper Detection**: Any modification to original documents breaks verification
- **Public Auditability**: Anyone can verify document integrity via blockchain explorer

## Contract Features

| Function                      | Description                                 |
| ----------------------------- | ------------------------------------------- |
| `anchorRoot(bytes32, string)` | Register a new document Merkle root         |
| `verifyRoot(bytes32)`         | Check if a root exists and get its metadata |
| `getRootCount()`              | Get total number of registered roots        |
| `getRootDetails(bytes32)`     | Get full details of a registered root       |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Get testnet ETH: https://www.coinbase.com/faucets/base-sepolia-faucet
DEPLOYER_PRIVATE_KEY=your_private_key_here

# Optional: For contract verification
BASESCAN_API_KEY=your_basescan_api_key
```

### 3. Run Tests

```bash
npx hardhat test
```

Expected output:

```
  DocumentRegistry
    Deployment
      ✔ Should deploy with zero roots
    anchorRoot
      ✔ Should successfully anchor a new Merkle root
      ✔ Should store correct document information
      ✔ Should reject duplicate Merkle roots
      ✔ Should emit RootAnchored event
      ✔ Should maintain root history order
    verifyRoot
      ✔ Should return exists=true for anchored root
      ✔ Should return exists=false for non-existent root
    getRootCount
      ✔ Should accurately track root count

  9 passing
```

### 4. Deploy to Local Hardhat Network

```bash
npx hardhat run scripts/deploy.ts
```

### 5. Deploy to Base Sepolia Testnet

```bash
npx hardhat run scripts/deploy.ts --network baseSepolia
```

### 6. Verify on Basescan (Optional)

```bash
npx hardhat verify --network baseSepolia <CONTRACT_ADDRESS>
```

Or use Hardhat Ignition:

```bash
npx hardhat ignition deploy ./ignition/modules/DocumentRegistry.ts --network baseSepolia
```

## Environment Variables

| Variable               | Description                                      | Required             |
| ---------------------- | ------------------------------------------------ | -------------------- |
| `BASE_SEPOLIA_RPC_URL` | RPC endpoint (default: https://sepolia.base.org) | No                   |
| `DEPLOYER_PRIVATE_KEY` | Wallet private key for deployment                | Yes (for deployment) |
| `BASESCAN_API_KEY`     | Basescan API key for verification                | No                   |

## Contract Address

After deployment, copy the contract address to your frontend `.env`:

```bash
NEXT_PUBLIC_REGISTRY_ADDRESS=0x...
```

## Network Details

| Network      | Chain ID | Explorer                     |
| ------------ | -------- | ---------------------------- |
| Base Sepolia | 84532    | https://sepolia.basescan.org |
| Base Mainnet | 8453     | https://basescan.org         |

## License

MIT
