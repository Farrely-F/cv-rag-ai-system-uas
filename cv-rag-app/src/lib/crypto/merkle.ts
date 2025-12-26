/**
 * Merkle Tree Utility
 * Constructs Merkle trees from chunk hashes and generates proofs
 */

import { MerkleTree } from "merkletreejs";
import crypto from "crypto";

export interface MerkleData {
  root: string;
  proofs: Map<string, string[]>;
}

/**
 * Build a Merkle tree from chunk hashes
 * Returns the root and proofs for each chunk
 */
export function buildMerkleTree(chunkHashes: string[]): MerkleData {
  const leaves = chunkHashes.map((hash) => Buffer.from(hash, "hex"));

  const tree = new MerkleTree(
    leaves,
    (data: Buffer) => crypto.createHash("sha256").update(data).digest(),
    {
      sortPairs: true,
      duplicateOdd: true,
    }
  );

  const root = tree.getRoot().toString("hex");
  const proofs = new Map<string, string[]>();

  chunkHashes.forEach((hash, index) => {
    const proof = tree
      .getProof(leaves[index])
      .map((p) => p.data.toString("hex"));
    proofs.set(hash, proof);
  });

  return { root, proofs };
}

/**
 * Verify a Merkle proof for a given chunk hash
 */
export function verifyMerkleProof(
  chunkHash: string,
  proof: string[],
  root: string
): boolean {
  const leaf = Buffer.from(chunkHash, "hex");
  const proofBuffers = proof.map((p) => Buffer.from(p, "hex"));
  const rootBuffer = Buffer.from(root, "hex");

  const tree = new MerkleTree(
    [],
    (data: Buffer) => crypto.createHash("sha256").update(data).digest(),
    { sortPairs: true }
  );

  return tree.verify(proofBuffers, leaf, rootBuffer);
}

/**
 * Get proof array for a specific chunk hash
 */
export function getProofForChunk(
  merkleData: MerkleData,
  chunkHash: string
): string[] {
  return merkleData.proofs.get(chunkHash) || [];
}

/**
 * Convert Merkle root to bytes32 format for blockchain
 */
export function rootToBytes32(root: string): `0x${string}` {
  return `0x${root}` as `0x${string}`;
}
