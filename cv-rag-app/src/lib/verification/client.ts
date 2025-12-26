/**
 * Client-Side Verification
 * Enables independent verification of chatbot responses
 */

import { verifyRootOnChain } from "@/lib/blockchain/registry";
import { verifyMerkleProof } from "@/lib/crypto/merkle";

export interface VerifiableSource {
  chunkId: string;
  content: string;
  chunkHash: string;
  merkleProof: string[];
  merkleRoot: string;
  blockchainTxId: string;
  documentMetadata: {
    fileName: string;
    fiscalYear: number;
    source: string;
  };
}

export interface SourceVerification {
  verified: boolean;
  error?: string;
  timestamp?: number;
  documentId?: string;
}

export interface VerificationResult {
  allVerified: boolean;
  sources: SourceVerification[];
}

/**
 * Hash text using Web Crypto API (client-side)
 */
async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify a single source
 */
export async function verifySource(
  source: VerifiableSource
): Promise<SourceVerification> {
  try {
    // Step 1: Re-hash the chunk content
    const recomputedHash = await hashText(source.content);

    if (recomputedHash !== source.chunkHash) {
      return {
        verified: false,
        error: "Chunk hash mismatch - content may have been modified",
      };
    }

    // Step 2: Verify Merkle proof
    const isValidProof = verifyMerkleProof(
      source.chunkHash,
      source.merkleProof,
      source.merkleRoot
    );

    if (!isValidProof) {
      return {
        verified: false,
        error: "Invalid Merkle proof - proof chain is broken",
      };
    }

    // Step 3: Verify root on blockchain
    const onChainData = await verifyRootOnChain(
      `0x${source.merkleRoot}` as `0x${string}`
    );

    if (!onChainData.exists) {
      return {
        verified: false,
        error: "Merkle root not found on blockchain",
      };
    }

    return {
      verified: true,
      timestamp: Number(onChainData.timestamp),
      documentId: onChainData.documentId,
    };
  } catch (error) {
    return {
      verified: false,
      error:
        error instanceof Error ? error.message : "Unknown verification error",
    };
  }
}

/**
 * Verify all sources in a response
 */
export async function verifyAllSources(
  sources: VerifiableSource[]
): Promise<VerificationResult> {
  const results = await Promise.all(sources.map(verifySource));

  return {
    allVerified: results.every((r) => r.verified),
    sources: results,
  };
}
