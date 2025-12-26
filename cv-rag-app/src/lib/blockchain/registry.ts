/**
 * DocumentRegistry Blockchain Client
 * Uses Viem for type-safe contract interactions
 */

import {
  createPublicClient,
  createWalletClient,
  http,
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
 */
export async function anchorMerkleRoot(
  merkleRoot: `0x${string}`,
  documentId: string
): Promise<`0x${string}`> {
  const privateKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}`;
  if (!privateKey) {
    throw new Error("ADMIN_PRIVATE_KEY not configured");
  }

  const account = privateKeyToAccount(privateKey);

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
