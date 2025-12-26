/**
 * SHA-256 Hashing Utility
 * Generates content hashes for document chunks
 */

import crypto from "crypto";

/**
 * Generate SHA-256 hash of text content
 */
export function generateChunkHash(text: string): string {
  return crypto.createHash("sha256").update(text.trim(), "utf8").digest("hex");
}

/**
 * Generate hashes for multiple chunks
 */
export function generateChunkHashes(chunks: string[]): string[] {
  return chunks.map(generateChunkHash);
}

/**
 * Verify that content matches its hash
 */
export function verifyHash(text: string, expectedHash: string): boolean {
  const computedHash = generateChunkHash(text);
  return computedHash === expectedHash;
}

/**
 * Client-side hash function (for browser verification)
 * Uses Web Crypto API
 */
export async function hashTextClient(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
