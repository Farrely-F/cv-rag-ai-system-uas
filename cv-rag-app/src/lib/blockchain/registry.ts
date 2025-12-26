/**
 * DocumentRegistry Blockchain Client
 * Uses Viem for type-safe contract interactions
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getAbiItem,
  type Address,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { DOCUMENT_REGISTRY_ABI } from "./abi";

// Contract address from environment
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address;

// RPC URL for Base Sepolia
const RPC_URL =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org";

// Public client for read operations
export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

/**
 * Anchor a Merkle root on the blockchain
 * Requires ADMIN_PRIVATE_KEY environment variable
 * Now handles duplicate roots by returning the original transaction hash
 */
export async function anchorMerkleRoot(
  merkleRoot: `0x${string}`,
  documentId: string
): Promise<`0x${string}`> {
  // Check if root already exists on-chain
  const onChain = await verifyRootOnChain(merkleRoot);
  if (onChain.exists) {
    console.log(
      `Merkle root ${merkleRoot} already exists on-chain. Finding original transaction...`
    );

    // Fetch original transaction hash from RootAnchored events
    // We search the last 50,000 blocks to avoid RPC range limits
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock > 50000n ? currentBlock - 50000n : 0n;

    const logs = await publicClient.getLogs({
      address: REGISTRY_ADDRESS,
      event: getAbiItem({
        abi: DOCUMENT_REGISTRY_ABI,
        name: "RootAnchored",
      }),
      args: { merkleRoot },
      fromBlock,
    });

    if (logs.length > 0 && logs[0].transactionHash) {
      console.log(`Found original transaction: ${logs[0].transactionHash}`);
      return logs[0].transactionHash;
    }

    // Fallback: If root exists but logs aren't found, we should still proceed
    // but the error below would likely happen anyway if we try to write.
    console.warn(
      `Root exists on-chain but original transaction log not found for ${merkleRoot}`
    );
  }

  let privateKey = process.env.ADMIN_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("ADMIN_PRIVATE_KEY not configured");
  }

  // Ensure 0x prefix
  if (!privateKey.startsWith("0x")) {
    privateKey = `0x${privateKey}`;
  }

  // Validate format
  if (privateKey.length !== 66) {
    throw new Error(
      `Invalid ADMIN_PRIVATE_KEY format. Expected 66 chars (0x + 64 hex), got ${privateKey.length}`
    );
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const hash = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: DOCUMENT_REGISTRY_ABI,
    functionName: "anchorRoot",
    args: [merkleRoot, documentId],
  });

  // Wait for transaction confirmation
  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

/**
 * Verify if a Merkle root exists on-chain
 */
export async function verifyRootOnChain(merkleRoot: `0x${string}`): Promise<{
  exists: boolean;
  timestamp: bigint;
  documentId: string;
}> {
  const result = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: DOCUMENT_REGISTRY_ABI,
    functionName: "verifyRoot",
    args: [merkleRoot],
  });

  return {
    exists: result[0],
    timestamp: result[1],
    documentId: result[2],
  };
}

/**
 * Get detailed information about a registered root
 */
export async function getRootDetails(merkleRoot: `0x${string}`) {
  const result = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: DOCUMENT_REGISTRY_ABI,
    functionName: "getRootDetails",
    args: [merkleRoot],
  });

  return {
    merkleRoot: result.merkleRoot,
    timestamp: result.timestamp,
    documentId: result.documentId,
    registeredBy: result.registeredBy,
  };
}

/**
 * Get the total count of registered roots
 */
export async function getRootCount(): Promise<bigint> {
  return await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: DOCUMENT_REGISTRY_ABI,
    functionName: "getRootCount",
  });
}

/**
 * Build Basescan URL for a transaction
 */
export function getBasescanUrl(txHash: string): string {
  return `https://sepolia.basescan.org/tx/${txHash}`;
}

/**
 * Build Basescan URL for a contract address
 */
export function getContractUrl(): string {
  return `https://sepolia.basescan.org/address/${REGISTRY_ADDRESS}`;
}
