# Technical Product Requirements Document (PRD)

## Cryptographically Verifiable RAG for E-Government Budget Transparency Chatbot - MVP

**Version:** 1.0  
**Date:** December 25, 2025  
**Project Lead:** Farrely Firenza  
**Target Audience:** AI-based IDE, Development Teams, Technical Stakeholders

---

## 1. Executive Summary

This PRD defines the technical requirements for building a Minimum Viable Product (MVP) of a Cryptographically Verifiable Retrieval-Augmented Generation (CV-RAG) system designed for e-government budget transparency. The system combines RAG architecture with cryptographic integrity verification and blockchain anchoring to create a trustworthy AI chatbot for Indonesian State Budget (APBN) queries.

**Core Innovation:** Every chatbot response is cryptographically traceable to immutable, blockchain-anchored source documents, enabling independent verification by citizens.

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CV-RAG System                            │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Admin Portal │    │ Public Chat  │    │  Blockchain  │  │
│  │   (Upload)   │    │  Interface   │    │   (Base L2)  │  │
│  └──────┬───────┘    └──────┬───────┘    └──────▲───────┘  │
│         │                   │                    │           │
│         ▼                   ▼                    │           │
│  ┌──────────────────────────────────────────────┴───────┐  │
│  │            Backend API (Next.js 15)                   │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │ Data Pipeline│  │Crypto Pipeline│  │RAG Pipeline│ │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │  │
│  └───────────────────────────┬──────────────────────────┘  │
│                              ▼                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL + pgvector (Supabase)                    │  │
│  │  - Document chunks                                    │  │
│  │  - Vector embeddings                                  │  │
│  │  - Cryptographic metadata                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer                | Technology                          | Version | Justification                                                           |
| -------------------- | ----------------------------------- | ------- | ----------------------------------------------------------------------- |
| **Framework**        | Next.js                             | 15.5.9  | Full-stack React framework with App Router for unified frontend/backend |
| **Language**         | TypeScript                          | 5.x     | Type safety across entire codebase                                      |
| **UI Library**       | React                               | 19.x    | Component-based UI with Server/Client Components                        |
| **Styling**          | Tailwind CSS + shadcn/ui            | Latest  | Rapid UI development with accessible components                         |
| **Animation**        | Framer Motion                       | Latest  | Smooth UI transitions and interactions                                  |
| **State Management** | TanStack Query (React Query)        | v5      | Async state, caching, and real-time updates                             |
| **Database**         | PostgreSQL (Supabase)               | Latest  | Managed PostgreSQL with vector extension                                |
| **Vector Search**    | pgvector                            | 0.5.x   | Native vector similarity search in PostgreSQL                           |
| **ORM**              | Drizzle ORM                         | Latest  | Type-safe SQL queries with excellent DX                                 |
| **LLM Provider**     | Google Gemini Flash 2.5             | Latest  | Optimal speed/cost balance for public chatbot                           |
| **AI SDK**           | Vercel AI SDK                       | Latest  | Streamlined LLM integration with streaming                              |
| **Embeddings**       | text-embedding-004                  | Latest  | Google's embedding model via AI SDK                                     |
| **Document Parsing** | pdf-parse, @langchain/textsplitters | Latest  | PDF extraction and semantic chunking                                    |
| **Blockchain**       | Base Sepolia Testnet                | L2      | Fast, low-cost Ethereum L2 for anchoring                                |
| **Smart Contracts**  | Solidity                            | 0.8.x   | DocumentRegistry contract                                               |
| **Contract Tooling** | Hardhat                             | Latest  | Local testing and deployment                                            |
| **Web3 Client**      | Wagmi + Viem                        | Latest  | Type-safe blockchain interactions                                       |
| **Wallet Connect**   | RainbowKit                          | Latest  | User-friendly wallet connection                                         |
| **Authentication**   | NextAuth.js                         | v5      | Session management for admin portal                                     |
| **Crypto Library**   | Node.js crypto, merkletreejs        | Latest  | SHA-256 hashing and Merkle tree construction                            |
| **Deployment**       | Vercel                              | -       | Seamless Next.js deployment with edge functions                         |

---

## 3. Core Components & Technical Requirements

### 3.1 Data Pipeline

**Purpose:** Transform raw budget documents into searchable, embeddable chunks.

#### 3.1.1 Document Ingestion API

**Endpoint:** `POST /api/ingest`

**Authentication:** Admin credentials via NextAuth session

**Request Format:**

```typescript
interface IngestRequest {
  file: File; // PDF, DOCX, or HTML
  metadata: {
    documentType: "APBN" | "APBD";
    fiscalYear: number;
    source: string; // e.g., "Ministry of Finance"
    uploadedBy: string;
  };
}
```

**Response Format:**

```typescript
interface IngestResponse {
  success: boolean;
  documentId: string;
  chunksProcessed: number;
  merkleRoot: string;
  blockchainTxId: string;
  processingTimeMs: number;
  errors?: string[];
}
```

#### 3.1.2 Document Processing Logic

**Implementation Requirements:**

1. **Text Extraction**

   - Use `pdf-parse` for standard PDFs
   - Fallback to Gemini Flash 2.5 multimodal for image-based PDFs
   - Preserve table structure and numerical context
   - Clean extracted text: remove headers, footers, page numbers

2. **Chunking Strategy**

   ```typescript
   interface ChunkingConfig {
     method: "semantic" | "fixed-overlap";
     maxChunkSize: 1000; // tokens
     overlap: 200; // tokens for fixed-overlap
     separators: ["\n\n", "\n", ". ", " "];
   }
   ```

   - Use `RecursiveCharacterTextSplitter` from @langchain/textsplitters
   - Apply semantic chunking for paragraphs
   - Apply fixed-overlap for tables to maintain context
   - Assign unique `chunkId` (UUID v4)

3. **Embedding Generation**
   ```typescript
   interface Chunk {
     id: string; // UUID
     documentId: string;
     text: string;
     embedding: number[]; // 768-dim vector from text-embedding-004
     metadata: {
       position: number; // chunk order in document
       tokens: number;
       pageNumber?: number;
     };
   }
   ```
   - Generate embeddings via Google AI API
   - Batch embedding calls (max 100 chunks per request)
   - Store in PostgreSQL with pgvector

#### 3.1.3 Database Schema

```typescript
// Drizzle ORM Schema (lib/db/schema.ts)

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileName: text("file_name").notNull(),
  documentType: text("document_type").notNull(), // 'APBN' | 'APBD'
  fiscalYear: integer("fiscal_year").notNull(),
  source: text("source").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  merkleRoot: text("merkle_root").notNull(),
  blockchainTxId: text("blockchain_tx_id").notNull(),
  status: text("status").default("active"), // 'active' | 'archived'
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id")
    .references(() => documents.id)
    .notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }).notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  merkleProof: jsonb("merkle_proof").notNull(), // Array of sibling hashes
  metadata: jsonb("metadata").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Indexes for performance
export const chunkEmbeddingIndex = index("chunk_embedding_idx")
  .on(documentChunks.embedding)
  .using("ivfflat"); // pgvector index type
```

---

### 3.2 Cryptographic Pipeline

**Purpose:** Create tamper-evident seals for document chunks and anchor them on blockchain.

#### 3.2.1 Hashing Implementation

```typescript
// lib/crypto/hash.ts

import crypto from "crypto";

export function generateChunkHash(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

export function generateChunkHashes(chunks: string[]): string[] {
  return chunks.map(generateChunkHash);
}
```

**Requirements:**

- Use SHA-256 via Node.js `crypto` module
- Hash normalized text (trim whitespace, consistent encoding)
- Store hash alongside chunk in database

#### 3.2.2 Merkle Tree Construction

```typescript
// lib/crypto/merkle.ts

import { MerkleTree } from "merkletreejs";
import crypto from "crypto";

export interface MerkleData {
  root: string;
  proofs: Map<string, string[]>; // chunkHash -> proof
}

export function buildMerkleTree(chunkHashes: string[]): MerkleData {
  const leaves = chunkHashes.map((hash) => Buffer.from(hash, "hex"));

  const tree = new MerkleTree(leaves, crypto.createHash("sha256"), {
    sortPairs: true,
    duplicateOdd: true,
  });

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

export function verifyMerkleProof(
  chunkHash: string,
  proof: string[],
  root: string
): boolean {
  const leaf = Buffer.from(chunkHash, "hex");
  const proofBuffers = proof.map((p) => Buffer.from(p, "hex"));

  const tree = new MerkleTree([], crypto.createHash("sha256"), {
    sortPairs: true,
  });

  return tree.verify(proofBuffers, leaf, Buffer.from(root, "hex"));
}
```

**Requirements:**

- Use `merkletreejs` library
- Sort pairs for deterministic tree structure
- Duplicate odd nodes for balanced tree
- Generate proof for each chunk hash
- Store proofs as JSONB in database

#### 3.2.3 Blockchain Anchoring

**Smart Contract (Solidity):**

```solidity
// contracts/DocumentRegistry.sol

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DocumentRegistry {
    struct DocumentRoot {
        bytes32 merkleRoot;
        uint256 timestamp;
        string documentId;
        address registeredBy;
    }

    mapping(bytes32 => DocumentRoot) public roots;
    bytes32[] public rootHistory;

    event RootAnchored(
        bytes32 indexed merkleRoot,
        string documentId,
        uint256 timestamp,
        address indexed registeredBy
    );

    function anchorRoot(
        bytes32 _merkleRoot,
        string memory _documentId
    ) external {
        require(roots[_merkleRoot].timestamp == 0, "Root already exists");

        roots[_merkleRoot] = DocumentRoot({
            merkleRoot: _merkleRoot,
            timestamp: block.timestamp,
            documentId: _documentId,
            registeredBy: msg.sender
        });

        rootHistory.push(_merkleRoot);

        emit RootAnchored(_merkleRoot, _documentId, block.timestamp, msg.sender);
    }

    function verifyRoot(bytes32 _merkleRoot) external view returns (
        bool exists,
        uint256 timestamp,
        string memory documentId
    ) {
        DocumentRoot memory root = roots[_merkleRoot];
        exists = root.timestamp != 0;
        timestamp = root.timestamp;
        documentId = root.documentId;
    }

    function getRootCount() external view returns (uint256) {
        return rootHistory.length;
    }
}
```

**Deployment Configuration (Hardhat):**

```typescript
// hardhat.config.ts

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY!],
      chainId: 84532,
    },
  },
};

export default config;
```

**Web3 Integration (Next.js):**

```typescript
// lib/blockchain/registry.ts

import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const REGISTRY_ABI = [...]; // Import from compiled contract
const REGISTRY_ADDRESS = process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as `0x${string}`;

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http()
});

export async function anchorMerkleRoot(
  merkleRoot: string,
  documentId: string
): Promise<string> {
  const account = privateKeyToAccount(
    process.env.ADMIN_PRIVATE_KEY as `0x${string}`
  );

  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http()
  });

  const hash = await walletClient.writeContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'anchorRoot',
    args: [merkleRoot as `0x${string}`, documentId]
  });

  await publicClient.waitForTransactionReceipt({ hash });

  return hash;
}

export async function verifyRootOnChain(
  merkleRoot: string
): Promise<{ exists: boolean; timestamp: bigint; documentId: string }> {
  const result = await publicClient.readContract({
    address: REGISTRY_ADDRESS,
    abi: REGISTRY_ABI,
    functionName: 'verifyRoot',
    args: [merkleRoot as `0x${string}`]
  });

  return {
    exists: result[0],
    timestamp: result[1],
    documentId: result[2]
  };
}
```

**Requirements:**

- Deploy contract to Base Sepolia testnet
- Store contract address in environment variables
- Use Viem for type-safe contract interactions
- Implement retry logic for blockchain transactions
- Log all transaction hashes to database
- Estimate gas before transaction submission

---

### 3.3 RAG Pipeline

**Purpose:** Retrieve relevant chunks and generate verifiable answers.

#### 3.3.1 Query Processing API

**Endpoint:** `POST /api/chat`

**Authentication:** Public (rate-limited)

**Request Format:**

```typescript
interface ChatRequest {
  message: string;
  conversationId?: string; // for multi-turn context
  topK?: number; // default: 3
}
```

**Response Format (Streaming):**

```typescript
interface ChatResponse {
  answer: string; // LLM-generated response
  sources: VerifiableSource[];
  conversationId: string;
  metadata: {
    tokensUsed: number;
    latencyMs: number;
  };
}

interface VerifiableSource {
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
```

#### 3.3.2 Vector Similarity Search

```typescript
// lib/rag/retrieval.ts

import { db } from "@/lib/db";
import { documentChunks, documents } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function retrieveRelevantChunks(
  queryEmbedding: number[],
  topK: number = 3,
  similarityThreshold: number = 0.7
): Promise<RetrievedChunk[]> {
  const embeddingString = `[${queryEmbedding.join(",")}]`;

  const results = await db
    .select({
      chunkId: documentChunks.id,
      content: documentChunks.content,
      chunkHash: documentChunks.sha256Hash,
      merkleProof: documentChunks.merkleProof,
      similarity: sql<number>`1 - (${documentChunks.embedding} <=> ${embeddingString}::vector)`,
      document: documents,
    })
    .from(documentChunks)
    .innerJoin(documents, eq(documentChunks.documentId, documents.id))
    .where(
      sql`1 - (${documentChunks.embedding} <=> ${embeddingString}::vector) > ${similarityThreshold}`
    )
    .orderBy(sql`${documentChunks.embedding} <=> ${embeddingString}::vector`)
    .limit(topK);

  return results.map((r) => ({
    chunkId: r.chunkId,
    content: r.content,
    chunkHash: r.chunkHash,
    merkleProof: r.merkleProof as string[],
    merkleRoot: r.document.merkleRoot,
    blockchainTxId: r.document.blockchainTxId,
    similarity: r.similarity,
    documentMetadata: {
      fileName: r.document.fileName,
      fiscalYear: r.document.fiscalYear,
      source: r.document.source,
    },
  }));
}
```

**Requirements:**

- Use pgvector's `<=>` operator for cosine distance
- Create IVFFlat index on embedding column for performance
- Filter by similarity threshold (default: 0.7)
- Return top-k results (default: 3, max: 10)
- Include full document metadata in response
- Measure and log retrieval latency

#### 3.3.3 LLM Answer Generation

```typescript
// app/api/chat/route.ts

import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { retrieveRelevantChunks } from "@/lib/rag/retrieval";
import { generateEmbedding } from "@/lib/ai/embeddings";

export async function POST(req: Request) {
  const { message, topK = 3 } = await req.json();

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(message);

  // Retrieve relevant chunks
  const chunks = await retrieveRelevantChunks(queryEmbedding, topK);

  if (chunks.length === 0) {
    return Response.json({
      answer:
        "I couldn't find relevant information in the budget documents to answer your question.",
      sources: [],
    });
  }

  // Build context from retrieved chunks
  const context = chunks
    .map((c, i) => `[Source ${i + 1}]\n${c.content}`)
    .join("\n\n");

  // Generate answer with streaming
  const result = await streamText({
    model: google("models/gemini-2.0-flash-exp"),
    system: `You are a helpful assistant for Indonesian government budget transparency.
    
Answer questions based ONLY on the provided source documents. If the information is not in the sources, say so clearly.

Rules:
- Be concise and factual
- Cite source numbers when referencing information
- Use Indonesian Rupiah (IDR) for currency
- Format large numbers with thousand separators (e.g., 1,500,000,000,000)
- If sources conflict, mention both perspectives
- Never make up budget figures`,
    prompt: `Context from official budget documents:

${context}

User question: ${message}

Answer:`,
    temperature: 0.3,
    maxTokens: 1000,
  });

  // Stream response with sources attached
  return result.toAIStreamResponse({
    headers: {
      "X-Sources": JSON.stringify(
        chunks.map((c) => ({
          chunkId: c.chunkId,
          chunkHash: c.chunkHash,
          merkleProof: c.merkleProof,
          merkleRoot: c.merkleRoot,
          blockchainTxId: c.blockchainTxId,
          documentMetadata: c.documentMetadata,
        }))
      ),
    },
  });
}
```

**Requirements:**

- Use Vercel AI SDK's `streamText` for real-time responses
- Set temperature to 0.3 for factual accuracy
- Implement strict system prompt to prevent hallucination
- Attach cryptographic metadata in response headers
- Log all queries and responses for audit trail
- Implement rate limiting (100 requests/hour per IP)

---

### 3.4 User Interface Components

#### 3.4.1 Admin Dashboard

**Route:** `/admin`

**Authentication:** Protected by NextAuth middleware

**Features:**

1. **Document Upload Interface**

   ```typescript
   // app/(admin)/admin/page.tsx

   "use client";

   import { useState } from "react";
   import { useUploadDocument } from "@/hooks/useUploadDocument";
   import { Button } from "@/components/ui/button";
   import { FileUpload } from "@/components/ui/file-upload";
   import { Progress } from "@/components/ui/progress";

   export default function AdminPage() {
     const { upload, isUploading, progress } = useUploadDocument();

     const handleUpload = async (file: File) => {
       const result = await upload({
         file,
         metadata: {
           documentType: "APBN",
           fiscalYear: 2023,
           source: "Ministry of Finance",
           uploadedBy: session.user.email,
         },
       });

       if (result.success) {
         toast.success(`Document processed: ${result.chunksProcessed} chunks`);
       }
     };

     return (
       <div className="container mx-auto py-8">
         <h1 className="text-3xl font-bold mb-8">Document Management</h1>

         <FileUpload
           onUpload={handleUpload}
           accept=".pdf,.docx"
           maxSize={50 * 1024 * 1024} // 50MB
           disabled={isUploading}
         />

         {isUploading && <Progress value={progress} className="mt-4" />}

         <DocumentLog />
       </div>
     );
   }
   ```

2. **Document Log Table**
   - Display all uploaded documents
   - Show processing status, chunk count, blockchain TX ID
   - Filter by fiscal year, document type
   - Click TX ID to open Basescan explorer
   - Archive/restore documents

**Design Requirements:**

- Clean, professional interface using shadcn/ui
- Real-time upload progress
- Toast notifications for success/errors
- Responsive design for tablets
- Dark mode support

#### 3.4.2 Public Chat Interface

**Route:** `/`

**Features:**

1. **Chat Window Component**

   ```typescript
   // app/(public)/page.tsx

   "use client";

   import { useChat } from "ai/react";
   import { ChatMessage } from "@/components/chat/ChatMessage";
   import { ChatInput } from "@/components/chat/ChatInput";
   import { VerificationPanel } from "@/components/chat/VerificationPanel";

   export default function ChatPage() {
     const { messages, input, handleInputChange, handleSubmit, isLoading } =
       useChat({
         api: "/api/chat",
       });

     return (
       <div className="flex h-screen">
         <div className="flex-1 flex flex-col">
           <ChatHeader />

           <div className="flex-1 overflow-y-auto p-4 space-y-4">
             {messages.map((message) => (
               <ChatMessage
                 key={message.id}
                 message={message}
                 showVerification={message.role === "assistant"}
               />
             ))}
           </div>

           <ChatInput
             value={input}
             onChange={handleInputChange}
             onSubmit={handleSubmit}
             disabled={isLoading}
             placeholder="Ask about the budget (e.g., 'What was the education budget in 2023?')"
           />
         </div>
       </div>
     );
   }
   ```

2. **Verifiable Answer Card**

   ```typescript
   // components/chat/ChatMessage.tsx

   export function ChatMessage({ message, showVerification }: Props) {
     const [isVerifying, setIsVerifying] = useState(false);
     const [verificationResult, setVerificationResult] =
       useState<VerificationResult | null>(null);

     const handleVerify = async () => {
       setIsVerifying(true);

       const sources = JSON.parse(message.metadata?.sources || "[]");
       const results = await Promise.all(sources.map(verifySource));

       setVerificationResult({
         allVerified: results.every((r) => r.verified),
         sources: results,
       });

       setIsVerifying(false);
     };

     return (
       <div className="flex gap-3">
         <Avatar />

         <div className="flex-1">
           <div className="prose">{message.content}</div>

           {showVerification && (
             <VerificationPanel
               sources={JSON.parse(message.metadata?.sources || "[]")}
               onVerify={handleVerify}
               isVerifying={isVerifying}
               result={verificationResult}
             />
           )}
         </div>
       </div>
     );
   }
   ```

3. **Verification Panel**

   ```typescript
   // components/chat/VerificationPanel.tsx

   export function VerificationPanel({ sources, onVerify, isVerifying, result }: Props) {
     return (
       <Collapsible className="mt-4 border rounded-lg p-4">
         <CollapsibleTrigger asChild>
           <Button variant="ghost" className="w-full">
             <ShieldCheck className="mr-2" />
             Verify this answer
           </Button>
         </CollapsibleTrigger>

         <CollapsibleContent className="mt-4 space-y-3">
           {sources.map((source, i) => (
             <div key={i} className="border-l-2 pl-4">
               <h4 className="font-medium">Source {i + 1}</h4>
               <p className="text-sm text-muted-foreground">{source.documentMetadata.fileName}</p>

               <div className="mt-2 space-y-1 text-xs font-mono">
                 <div>Chunk Hash: {source.chunkHash.slice(0, 16)}...</div>
                 <div>Merkle Root: {source.merkleRoot.slice(0, 16)}...</div>
                 <div>
                   Blockchain TX:{' '}

                     href={`https://sepolia.basescan.org/tx/${source.blockchainTxId}`}
                     target="_blank"
                     className="text-blue-600 hover:underline"
                   >
                     {source.blockchainTxId.slice(0, 16)}...
                   </a>
                 </div>
               </div>

               {result?.sources[i] && (
                 <Badge className={result.sources[i].verified ? 'bg-green-600' : 'bg-red-600'}>
                   {result.sources[i].verified ? '✓ Verified' : '✗ Verification Failed'}
                 </Badge>
               )}
             </div>
           ))}

           <Button
             onClick={onVerify}
             disabled={isVerifying}
             className="w-full"
           >
             {isVerifying ? 'Verifying...' : 'Run Verification'}
           </Button>
         </CollapsibleContent>
       </Collapsible>
     );
   }
   ```

4. **Client-Side Verification Logic**

   ```typescript
   // lib/verification/client.ts

   export async function verifySource(
     source: VerifiableSource
   ): Promise<SourceVerification> {
     try {
       // Step 1: Re-hash the chunk content
       const recomputedHash = await hashText(source.content);

       if (recomputedHash !== source.chunkHash) {
         return {
           verified: false,
           error: "Chunk hash mismatch",
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
           error: "Invalid Merkle proof",
         };
       }

       // Step 3: Verify root on blockchain
       const onChainData = await verifyRootOnChain(source.merkleRoot);

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
         error: error.message,
       };
     }
   }

   async function hashText(text: string): Promise<string> {
     const encoder = new TextEncoder();
     const data = encoder.encode(text);
     const hashBuffer = await crypto.subtle.digest("SHA-256", data);
     const hashArray = Array.from(new Uint8Array(hashBuffer));
     return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
   }
   ```

**Design Requirements:**

- Modern chat interface similar to ChatGPT
- Streaming responses with typing indicator
- Expand/collapse verification panel
- Color-coded verification status (green = verified, red = failed)
- Direct links to blockchain explorer
- Mobile-responsive design
- Accessibility (ARIA labels, keyboard navigation)

---

## 4. API Specifications

### 4.1 Admin Endpoints

#### POST /api/admin/login

Authenticate admin user.

**Request:**

```json
{
  "email": "admin@example.com",
  "password": "securepassword"
}
```

**Response:**

```json
{
  "success": true,
  "sessionToken": "..."
}
```

#### POST /api/ingest

Upload and process document (requires authentication).

**Headers:**

- `Authorization: Bearer <sessionToken>`
- `Content-Type: multipart/form-data`

**Request Body:**

- `file`: File upload (PDF/DOCX)
- `documentType`: 'APBN' | 'APBD'
- `fiscalYear`: number
- `source`: string

**Response:** (See Section 3.1.1)

#### GET /api/admin/documents

List all documents.

**Query Parameters:**

- `page`: number (default: 1)
- `limit`: number (default: 20)
- `fiscalYear`: number (optional)
- `documentType`: string (optional)

**Response:**

```json
{
  "documents": [
    {
      "id": "uuid",
      "fileName": "APBN_2023.pdf",
      "fiscalYear": 2023,
      "chunksProcessed": 450,
      "merkleRoot": "0x...",
      "blockchainTxId": "0x...",
      "uploadedAt": "2025-12-25T10:00:00Z",
      "status": "active"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

### 4.2 Public Endpoints

#### POST /api/chat

Submit query and receive verifiable answer (see Section 3.3.1).

#### GET /api/health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "database": "connected",
  "blockchain": "connected",
  "version": "1.0.0"
}
```

---

## 5. Environment Variables

Create `.env.local` file with the following:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/cvrag"
DIRECT_URL="postgresql://user:password@host:5432/cvrag" # For migrations

# AI Services
GOOGLE_GENERATIVE_AI_API_KEY="your-gemini-api-key"

# Blockchain
NEXT_PUBLIC_REGISTRY_ADDRESS="0x..." # Deployed contract address
NEXT_PUBLIC_BASE_SEPOLIA_RPC="https://sepolia.base.org"
ADMIN_PRIVATE_KEY="0x..." # For backend blockchain writes
NEXT_PUBLIC_BASESCAN_URL="https://sepolia.basescan.org"

# Authentication
NEXTAUTH_SECRET="random-secret-string"
NEXTAUTH_URL="http://localhost:3000"

# Admin Credentials (hashed in production)
ADMIN_EMAIL="admin@cvrag.gov"
ADMIN_PASSWORD_HASH="bcrypt-hash"

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

---

## 6. Development Workflow

### 6.1 Setup Instructions

```bash
# Clone repository
git clone <repo-url>
cd cv-rag-chatbot

# Install dependencies
npm install

# Setup database
npm run db:push  # Push schema to Supabase
npm run db:seed  # Seed with sample admin user

# Deploy smart contract
cd contracts
npx hardhat compile
npx hardhat run scripts/deploy.ts --network baseSepolia
# Copy deployed address to .env.local

# Run development server
npm run dev
```

### 6.2 Testing Strategy

**Unit Tests:**

- Cryptographic functions (hashing, Merkle tree)
- Database queries
- API route handlers

```bash
npm run test
```

**Integration Tests:**

- End-to-end document ingestion
- RAG retrieval accuracy
- Blockchain verification

```bash
npm run test:integration
```

**Performance Tests:**

- Query latency benchmarks
- Vector search performance
- Blockchain transaction timing

```bash
npm run test:performance
```

### 6.3 Deployment

**Vercel Deployment:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Environment Configuration:**

- Add all environment variables in Vercel dashboard
- Enable Edge Functions for API routes
- Configure Supabase database pooler for serverless

**Post-Deployment:**

1. Deploy smart contract to mainnet (if needed)
2. Update `NEXT_PUBLIC_REGISTRY_ADDRESS`
3. Run smoke tests on production
4. Monitor logs and metrics

---

## 7. Performance Requirements

### 7.1 Targets

| Metric                         | Target                | Measurement                            |
| ------------------------------ | --------------------- | -------------------------------------- |
| **Query Response Time**        | < 3 seconds (p95)     | End-to-end from query to first token   |
| **Chunk Retrieval**            | < 500ms               | Vector search only                     |
| **Verification Time**          | < 2 seconds           | Client-side cryptographic verification |
| **Document Ingestion**         | < 5 min per 100 pages | Full pipeline including blockchain     |
| **Blockchain TX Confirmation** | < 30 seconds          | Base Sepolia average                   |
| **Concurrent Users**           | 100                   | Simultaneous active chat sessions      |
| **Database Query**             | < 100ms (p95)         | Postgres queries                       |

### 7.2 Optimization Strategies

1. **Vector Search:**

   - Use IVFFlat index with appropriate list count
   - Consider HNSW index for larger datasets (>1M vectors)
   - Implement pagination for large result sets

2. **LLM Calls:**

   - Stream responses to improve perceived latency
   - Implement caching for common queries
   - Use Gemini Flash (faster) vs Pro (more accurate)

3. **Blockchain:**

   - Batch multiple documents into single Merkle root
   - Use L2 (Base) for low gas fees
   - Implement transaction queue with retry logic

4. **Database:**
   - Index frequently queried columns
   - Use connection pooling (Supabase Pooler)
   - Implement Redis cache for hot documents

---

## 8. Security Considerations

### 8.1 Authentication & Authorization

- Admin portal: Session-based auth via NextAuth
- API routes: Validate session tokens
- Document upload: Restrict file types, scan for malware
- Rate limiting: 100 requests/hour per IP for public chat

### 8.2 Data Protection

- Environment variables: Never commit to Git
- Private keys: Use secure key management (Vercel environment variables)
- Database: Enable SSL connections
- HTTPS only in production

### 8.3 Input Validation

- Sanitize all user inputs
- Validate file uploads (size, type, content)
- Prevent SQL injection via parameterized queries (Drizzle ORM)
- Escape LLM responses to prevent XSS

### 8.4 Blockchain Security

- Use testnet for MVP (Base Sepolia)
- Audit smart contract before mainnet deployment
- Implement gas limit checks
- Monitor for replay attacks

---

## 9. Monitoring & Logging

### 9.1 Application Monitoring

**Vercel Analytics:**

- Track page views, user sessions
- Monitor API route performance
- Alert on error rate spikes

**Custom Metrics:**

```typescript
// lib/metrics.ts

export async function logQuery(data: {
  query: string;
  responseTime: number;
  chunksRetrieved: number;
  tokensUsed: number;
  verified: boolean;
}) {
  await db.insert(queryLogs).values({
    ...data,
    timestamp: new Date(),
  });
}
```

### 9.2 Error Tracking

**Sentry Integration:**

```typescript
// sentry.config.ts

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### 9.3 Logging Strategy

- Use structured logging (JSON format)
- Log levels: DEBUG, INFO, WARN, ERROR
- Sensitive data: Never log private keys, hashes of PII
- Retention: 30 days for application logs

---

## 10. MVP Scope & Milestones

### Phase 1: Core Infrastructure (Week 1-2)

- ✅ Set up Next.js project with TypeScript
- ✅ Configure PostgreSQL + pgvector on Supabase
- ✅ Deploy smart contract to Base Sepolia
- ✅ Implement basic authentication

### Phase 2: Data Pipeline (Week 3-4)

- ✅ PDF parsing and chunking
- ✅ Embedding generation
- ✅ Cryptographic hashing
- ✅ Merkle tree construction
- ✅ Blockchain anchoring

### Phase 3: RAG Pipeline (Week 5-6)

- ✅ Vector similarity search
- ✅ LLM integration (Gemini Flash)
- ✅ Prompt engineering
- ✅ Response streaming

### Phase 4: UI Development (Week 7-8)

- ✅ Admin dashboard
- ✅ Public chat interface
- ✅ Verification panel
- ✅ Client-side verification logic

### Phase 5: Testing & Optimization (Week 9-10)

- ✅ Unit and integration tests
- ✅ Performance benchmarking
- ✅ Security audit
- ✅ Documentation

### Phase 6: Deployment & Launch (Week 11-12)

- ✅ Production deployment to Vercel
- ✅ Load testing
- ✅ Monitoring setup
- ✅ User acceptance testing

---

## 11. Future Enhancements (Post-MVP)

1. **Multi-language Support**

   - Indonesian and English UI
   - Multilingual embeddings

2. **Advanced Analytics**

   - Query analytics dashboard
   - Document usage heatmaps

3. **Enhanced Verification**

   - QR code for mobile verification
   - Browser extension for one-click verification

4. **Scalability**

   - Migrate to mainnet (Base or Ethereum)
   - Implement CDN for static assets
   - Distributed vector database

5. **AI Improvements**
   - Fine-tuned model on budget documents
   - Multi-modal support (charts, tables)
   - Conversational context memory

---

## 12. Acceptance Criteria

The MVP is considered complete when:

1. ✅ Admin can upload APBN PDF and see it processed
2. ✅ System generates Merkle root and anchors on Base Sepolia
3. ✅ Public user can ask budget questions via chat
4. ✅ System retrieves relevant chunks with >70% accuracy (human-evaluated)
5. ✅ LLM generates factual answers based on retrieved chunks
6. ✅ User can verify answer cryptographically
7. ✅ Verification shows green "✓ Verified" for unaltered data
8. ✅ Blockchain transaction is viewable on Basescan
9. ✅ System handles 50 concurrent users without degradation
10. ✅ All unit and integration tests pass
11. ✅ Documentation is complete and published

---

## 13. Dependencies & Prerequisites

### 13.1 External Services

- **Supabase** (PostgreSQL + pgvector): Free tier sufficient for MVP
- **Google AI API**: Gemini Flash 2.5 + text-embedding-004
- **Base Sepolia Testnet**: Free testnet ETH from faucet
- **Vercel**: Free hobby tier for deployment
- **GitHub**: Code repository

### 13.2 Development Tools

- Node.js 18+ and npm/pnpm
- Git
- PostgreSQL client (optional, for local testing)
- Hardhat (smart contract development)
- VS Code or similar IDE

---

## 14. Risk Mitigation

| Risk                       | Impact    | Mitigation                                               |
| -------------------------- | --------- | -------------------------------------------------------- |
| **LLM Hallucination**      | High      | Strict system prompts, low temperature, cite sources     |
| **Blockchain Downtime**    | Medium    | Retry logic, testnet fallback, cache TX results          |
| **Vector Search Slow**     | Medium    | Optimize indexes, implement caching, pagination          |
| **Document Parsing Fails** | Medium    | Fallback to multimodal LLM, manual review queue          |
| **High Costs**             | Medium    | Use free tiers, optimize LLM calls, batch operations     |
| **Data Tampering**         | Critical  | Immutable blockchain records, cryptographic verification |
| **Scalability Issues**     | Low (MVP) | Design for scale, monitor metrics, plan for CDN          |

---

## 15. Success Metrics

### 15.1 Technical Metrics

- **Retrieval Accuracy:** >80% Recall@3 on benchmark Q&A set
- **Answer Quality:** >4.0/5.0 human rating on factual accuracy
- **System Uptime:** 99% availability
- **Verification Success Rate:** 100% for unaltered data

### 15.2 User Metrics (Post-Launch)

- **Daily Active Users:** Track engagement
- **Verification Usage:** % of users clicking "Verify"
- **Query Satisfaction:** Thumbs up/down feedback
- **Average Session Duration:** Indicator of usefulness

---

## 16. Documentation Requirements

### 16.1 Technical Documentation

- **README.md:** Quick start guide, architecture overview
- **API.md:** Complete API reference with examples
- **DEPLOYMENT.md:** Step-by-step deployment instructions
- **ARCHITECTURE.md:** System design deep dive
- **VERIFICATION.md:** How cryptographic verification works

### 16.2 User Documentation

- **User Guide:** How to use the chat interface
- **Verification Tutorial:** Step-by-step verification guide
- **FAQ:** Common questions and answers

### 16.3 Code Documentation

- Inline comments for complex logic
- JSDoc for all exported functions
- Type definitions for all interfaces

---

## 17. Appendix

### 17.1 Sample Budget Documents

For MVP testing, use these publicly available APBN documents:

- APBN 2023: [Link to Ministry of Finance]
- APBN 2022: [Link to Ministry of Finance]

### 17.2 Benchmark Q&A Set

Create a test set of 50 questions covering:

- Total budget amounts
- Sector-specific allocations
- Year-over-year changes
- Specific line items

### 17.3 Code Style Guide

- Follow Next.js conventions
- Use TypeScript strict mode
- Format with Prettier
- Lint with ESLint
- Commit messages: Conventional Commits format

---

**Document Version:** 1.0  
**Last Updated:** December 25, 2025  
**Prepared by:** CV-RAG Development Team  
**Contact:** farrely.firenza@example.com

---

This PRD provides comprehensive technical specifications for building the CV-RAG MVP. All sections are designed to be consumed by AI-based IDEs (like Cursor, GitHub Copilot, or similar) for automated code generation and implementation guidance.
