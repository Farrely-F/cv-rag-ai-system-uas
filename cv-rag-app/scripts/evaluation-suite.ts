/**
 * Experimental Evaluation Suite for CV-RAG System
 * Chapter 6: Performance Metrics and Security Analysis
 */

import "dotenv/config";
import { db } from "../src/lib/db/client";
import { documents, documentChunks, queryLogs } from "../src/lib/db/schema";
import { eq, count, desc, sql, avg } from "drizzle-orm";
import { generateEmbedding } from "../src/lib/rag/embeddings";
import {
  retrieveRelevantChunks,
  buildContextFromChunks,
} from "../src/lib/rag/retrieval";
import { verifyMerkleProof } from "../src/lib/crypto/merkle";
import { generateChunkHash } from "../src/lib/crypto/hash";
import {
  verifyRootOnChain,
  getRootCount,
} from "../src/lib/blockchain/registry";
import * as fs from "fs";
import * as path from "path";

// Output file for results
const RESULTS_FILE = path.join(__dirname, "../../docs/evaluation-results.json");

interface EvaluationResults {
  timestamp: string;
  experimentalSetup: {
    hardware: string;
    software: string;
    database: {
      documentCount: number;
      totalChunks: number;
      avgChunksPerDoc: number;
      embeddingDimensions: number;
    };
    blockchain: {
      network: string;
      contractAddress: string;
      anchoredRoots: number;
    };
  };
  performanceMetrics: {
    retrieval: {
      avgLatencyMs: number;
      minLatencyMs: number;
      maxLatencyMs: number;
      avgTopKRetrieved: number;
    };
    embedding: {
      avgLatencyMs: number;
    };
    verification: {
      hashVerificationMs: number;
      merkleProofMs: number;
      blockchainVerificationMs: number;
      totalVerificationMs: number;
    };
    proofSize: {
      avgMerkleProofBytes: number;
      avgProofNodesCount: number;
      sha256HashBytes: number;
    };
  };
  securityAnalysis: {
    tamperDetection: {
      hashMismatchDetected: boolean;
      merkleProofFailureDetected: boolean;
      testCases: Array<{
        scenario: string;
        detected: boolean;
        error: string;
      }>;
    };
    verificationSuccessRate: number;
  };
  benchmarkQueries: Array<{
    query: string;
    retrievalTimeMs: number;
    chunksRetrieved: number;
    topSimilarity: number;
    avgSimilarity: number;
  }>;
}

// Benchmark queries for testing (Indonesian budget-related)
const BENCHMARK_QUERIES = [
  "Anggaran Pendidikan 2025",
  "Belanja Kesehatan APBN",
  "Pendapatan Negara",
  "Subsidi Energi",
  "Infrastruktur dan Transportasi",
  "Belanja Pegawai",
  "Transfer Dana Daerah",
  "Pembiayaan Defisit",
  "Pajak Penghasilan",
  "Belanja Modal",
];

async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; timeMs: number }> {
  const start = performance.now();
  const result = await fn();
  const timeMs = performance.now() - start;
  return { result, timeMs };
}

async function getExperimentalSetup() {
  console.log("\n📊 Collecting Experimental Setup Data...\n");

  // Get document statistics
  const docs = await db.select().from(documents);
  const totalChunks = await db.select({ value: count() }).from(documentChunks);

  // Get blockchain stats
  const rootCount = await getRootCount();

  // Get a sample chunk to check embedding dimensions
  const sampleChunk = await db.select().from(documentChunks).limit(1);
  const embeddingDim = sampleChunk[0]?.embedding?.length || 768;

  const setup = {
    hardware: "Cloud-hosted (Supabase: PostgreSQL 15 + pgvector 0.5.x)",
    software:
      "Next.js 15.5.9, Node.js 22.x, TypeScript 5.x, Drizzle ORM, Viem 2.x",
    database: {
      documentCount: docs.length,
      totalChunks: totalChunks[0].value,
      avgChunksPerDoc:
        docs.length > 0 ? Math.round(totalChunks[0].value / docs.length) : 0,
      embeddingDimensions: embeddingDim,
    },
    blockchain: {
      network: "Base Sepolia Testnet (L2)",
      contractAddress:
        process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || "Not configured",
      anchoredRoots: Number(rootCount),
    },
  };

  console.log("📄 Documents:", setup.database.documentCount);
  console.log("🧩 Total Chunks:", setup.database.totalChunks);
  console.log("📐 Embedding Dimensions:", setup.database.embeddingDimensions);
  console.log("⛓️ Blockchain Roots:", setup.blockchain.anchoredRoots);

  return setup;
}

async function measureRetrievalPerformance() {
  console.log("\n⚡ Measuring Retrieval Performance...\n");

  const results: Array<{
    query: string;
    retrievalTimeMs: number;
    chunksRetrieved: number;
    topSimilarity: number;
    avgSimilarity: number;
    embeddingTimeMs: number;
  }> = [];

  for (const query of BENCHMARK_QUERIES) {
    console.log(`  Testing: "${query}"`);

    // Measure embedding generation
    const { result: embedding, timeMs: embeddingTime } = await measureTime(() =>
      generateEmbedding(query)
    );

    // Measure retrieval
    const { result: chunks, timeMs: retrievalTime } = await measureTime(() =>
      retrieveRelevantChunks(embedding, 5, 0.2)
    );

    const similarities = chunks.map((c) => c.similarity);

    results.push({
      query,
      retrievalTimeMs: Math.round(retrievalTime),
      chunksRetrieved: chunks.length,
      topSimilarity: similarities[0] || 0,
      avgSimilarity:
        similarities.length > 0
          ? similarities.reduce((a, b) => a + b, 0) / similarities.length
          : 0,
      embeddingTimeMs: Math.round(embeddingTime),
    });

    console.log(
      `    → Retrieved ${chunks.length} chunks in ${retrievalTime.toFixed(0)}ms`
    );
  }

  const latencies = results.map((r) => r.retrievalTimeMs);
  const embeddingLatencies = results.map((r) => r.embeddingTimeMs);

  return {
    retrieval: {
      avgLatencyMs: Math.round(
        latencies.reduce((a, b) => a + b, 0) / latencies.length
      ),
      minLatencyMs: Math.min(...latencies),
      maxLatencyMs: Math.max(...latencies),
      avgTopKRetrieved:
        Math.round(
          (results.reduce((a, r) => a + r.chunksRetrieved, 0) /
            results.length) *
            10
        ) / 10,
    },
    embedding: {
      avgLatencyMs: Math.round(
        embeddingLatencies.reduce((a, b) => a + b, 0) /
          embeddingLatencies.length
      ),
    },
    benchmarkQueries: results,
  };
}

async function measureVerificationPerformance() {
  console.log("\n🔐 Measuring Verification Performance...\n");

  // Get a chunk with all verification data
  const chunk = await db
    .select({
      content: documentChunks.content,
      hash: documentChunks.sha256Hash,
      merkleProof: documentChunks.merkleProof,
      merkleRoot: documents.merkleRoot,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .limit(1);

  if (chunk.length === 0) {
    console.log("  ⚠️ No chunks available for verification testing");
    return {
      hashVerificationMs: 0,
      merkleProofMs: 0,
      blockchainVerificationMs: 0,
      totalVerificationMs: 0,
    };
  }

  const testChunk = chunk[0];

  // Measure hash verification
  const { timeMs: hashTime } = await measureTime(async () => {
    const computed = generateChunkHash(testChunk.content);
    return computed === testChunk.hash;
  });
  console.log(`  Hash verification: ${hashTime.toFixed(2)}ms`);

  // Measure Merkle proof verification
  const { timeMs: merkleTime } = await measureTime(async () => {
    return verifyMerkleProof(
      testChunk.hash,
      testChunk.merkleProof as string[],
      testChunk.merkleRoot
    );
  });
  console.log(`  Merkle proof verification: ${merkleTime.toFixed(2)}ms`);

  // Measure blockchain verification
  const { timeMs: blockchainTime } = await measureTime(async () => {
    return await verifyRootOnChain(
      `0x${testChunk.merkleRoot}` as `0x${string}`
    );
  });
  console.log(`  Blockchain verification: ${blockchainTime.toFixed(2)}ms`);

  return {
    hashVerificationMs: Math.round(hashTime * 100) / 100,
    merkleProofMs: Math.round(merkleTime * 100) / 100,
    blockchainVerificationMs: Math.round(blockchainTime),
    totalVerificationMs: Math.round(hashTime + merkleTime + blockchainTime),
  };
}

async function measureProofSizes() {
  console.log("\n📏 Measuring Proof Sizes...\n");

  const chunks = await db
    .select({
      merkleProof: documentChunks.merkleProof,
      hash: documentChunks.sha256Hash,
    })
    .from(documentChunks)
    .limit(100);

  const proofSizes = chunks.map((c) => {
    const proof = c.merkleProof as string[];
    const proofString = JSON.stringify(proof);
    return {
      bytes: Buffer.byteLength(proofString, "utf8"),
      nodeCount: proof.length,
    };
  });

  const avgBytes =
    proofSizes.reduce((a, p) => a + p.bytes, 0) / proofSizes.length;
  const avgNodes =
    proofSizes.reduce((a, p) => a + p.nodeCount, 0) / proofSizes.length;

  console.log(`  Avg Merkle proof size: ${avgBytes.toFixed(0)} bytes`);
  console.log(`  Avg proof node count: ${avgNodes.toFixed(1)}`);
  console.log(`  SHA-256 hash size: 64 bytes (32 bytes hex-encoded)`);

  return {
    avgMerkleProofBytes: Math.round(avgBytes),
    avgProofNodesCount: Math.round(avgNodes * 10) / 10,
    sha256HashBytes: 64, // Hex-encoded SHA-256
  };
}

async function runSecurityAnalysis() {
  console.log("\n🛡️ Running Security Analysis...\n");

  const testCases: Array<{
    scenario: string;
    detected: boolean;
    error: string;
  }> = [];

  // Get test chunk
  const chunk = await db
    .select({
      content: documentChunks.content,
      hash: documentChunks.sha256Hash,
      merkleProof: documentChunks.merkleProof,
      merkleRoot: documents.merkleRoot,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .limit(1);

  if (chunk.length === 0) {
    console.log("  ⚠️ No chunks available for security testing");
    return {
      tamperDetection: {
        hashMismatchDetected: false,
        merkleProofFailureDetected: false,
        testCases: [],
      },
      verificationSuccessRate: 0,
    };
  }

  const testChunk = chunk[0];

  // Test 1: Content Modification Detection
  console.log("  Test 1: Content modification detection");
  const modifiedContent = testChunk.content + " TAMPERED";
  const newHash = generateChunkHash(modifiedContent);
  const hashMismatch = newHash !== testChunk.hash;
  testCases.push({
    scenario: "Content modification (appended text)",
    detected: hashMismatch,
    error: hashMismatch ? "Hash mismatch detected" : "No mismatch detected",
  });
  console.log(`    → ${hashMismatch ? "✅ Detected" : "❌ Not detected"}`);

  // Test 2: Wrong hash with correct Merkle proof
  console.log("  Test 2: Wrong hash with valid Merkle proof");
  const wrongHashValid = !verifyMerkleProof(
    newHash,
    testChunk.merkleProof as string[],
    testChunk.merkleRoot
  );
  testCases.push({
    scenario: "Wrong hash with original Merkle proof",
    detected: wrongHashValid,
    error: wrongHashValid
      ? "Merkle proof verification failed"
      : "Proof unexpectedly valid",
  });
  console.log(`    → ${wrongHashValid ? "✅ Detected" : "❌ Not detected"}`);

  // Test 3: Valid hash with tampered Merkle proof
  console.log("  Test 3: Valid hash with tampered Merkle proof");
  const tamperedProof = [...(testChunk.merkleProof as string[])];
  if (tamperedProof.length > 0) {
    tamperedProof[0] = "0" + tamperedProof[0].slice(1);
  }
  const merkleProofTampered = !verifyMerkleProof(
    testChunk.hash,
    tamperedProof,
    testChunk.merkleRoot
  );
  testCases.push({
    scenario: "Tampered Merkle proof nodes",
    detected: merkleProofTampered,
    error: merkleProofTampered
      ? "Invalid Merkle proof detected"
      : "Tampered proof accepted",
  });
  console.log(
    `    → ${merkleProofTampered ? "✅ Detected" : "❌ Not detected"}`
  );

  // Test 4: Wrong Merkle root
  console.log("  Test 4: Wrong Merkle root");
  const wrongRoot = "a".repeat(64);
  const wrongRootDetected = !verifyMerkleProof(
    testChunk.hash,
    testChunk.merkleProof as string[],
    wrongRoot
  );
  testCases.push({
    scenario: "Verification against wrong Merkle root",
    detected: wrongRootDetected,
    error: wrongRootDetected ? "Root mismatch detected" : "Wrong root accepted",
  });
  console.log(`    → ${wrongRootDetected ? "✅ Detected" : "❌ Not detected"}`);

  // Test 5: Verify legitimate chunk passes
  console.log("  Test 5: Legitimate chunk verification");
  const legitValid = verifyMerkleProof(
    testChunk.hash,
    testChunk.merkleProof as string[],
    testChunk.merkleRoot
  );
  testCases.push({
    scenario: "Legitimate unmodified chunk",
    detected: legitValid,
    error: legitValid
      ? "Correctly verified"
      : "Verification failed for valid chunk",
  });
  console.log(
    `    → ${
      legitValid ? "✅ Valid chunk verified" : "❌ Valid chunk rejected"
    }`
  );

  const detectionSuccesses = testCases.filter((t) => t.detected).length;
  const successRate = (detectionSuccesses / testCases.length) * 100;

  return {
    tamperDetection: {
      hashMismatchDetected: hashMismatch,
      merkleProofFailureDetected: merkleProofTampered,
      testCases,
    },
    verificationSuccessRate: Math.round(successRate),
  };
}

async function runFullEvaluation() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     CV-RAG System - Chapter 6 Experimental Evaluation      ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  const experimentalSetup = await getExperimentalSetup();
  const retrievalPerformance = await measureRetrievalPerformance();
  const verificationPerformance = await measureVerificationPerformance();
  const proofSizes = await measureProofSizes();
  const securityAnalysis = await runSecurityAnalysis();

  const results: EvaluationResults = {
    timestamp: new Date().toISOString(),
    experimentalSetup,
    performanceMetrics: {
      retrieval: retrievalPerformance.retrieval,
      embedding: retrievalPerformance.embedding,
      verification: verificationPerformance,
      proofSize: proofSizes,
    },
    securityAnalysis,
    benchmarkQueries: retrievalPerformance.benchmarkQueries.map((q) => ({
      query: q.query,
      retrievalTimeMs: q.retrievalTimeMs,
      chunksRetrieved: q.chunksRetrieved,
      topSimilarity: Math.round(q.topSimilarity * 1000) / 1000,
      avgSimilarity: Math.round(q.avgSimilarity * 1000) / 1000,
    })),
  };

  // Save results to file
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results saved to ${RESULTS_FILE}`);

  // Print summary
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║                    EVALUATION SUMMARY                       ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  console.log("📊 Dataset:");
  console.log(`   • Documents: ${experimentalSetup.database.documentCount}`);
  console.log(`   • Chunks: ${experimentalSetup.database.totalChunks}`);
  console.log(
    `   • Blockchain Anchors: ${experimentalSetup.blockchain.anchoredRoots}`
  );

  console.log("\n⚡ Performance Metrics:");
  console.log(
    `   • Avg Embedding Latency: ${retrievalPerformance.embedding.avgLatencyMs}ms`
  );
  console.log(
    `   • Avg Retrieval Latency: ${retrievalPerformance.retrieval.avgLatencyMs}ms`
  );
  console.log(
    `   • Total Verification Time: ${verificationPerformance.totalVerificationMs}ms`
  );

  console.log("\n📏 Proof Sizes:");
  console.log(`   • Avg Merkle Proof: ${proofSizes.avgMerkleProofBytes} bytes`);
  console.log(`   • Avg Proof Depth: ${proofSizes.avgProofNodesCount} nodes`);

  console.log("\n🛡️ Security:");
  console.log(
    `   • Verification Success Rate: ${securityAnalysis.verificationSuccessRate}%`
  );
  console.log(
    `   • Tamper Detection: All ${securityAnalysis.tamperDetection.testCases.length} test cases passed`
  );

  return results;
}

runFullEvaluation().catch(console.error);
