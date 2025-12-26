/**
 * Database Schema for CV-RAG System
 * Uses Drizzle ORM with PostgreSQL + pgvector
 */

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  vector,
} from "drizzle-orm/pg-core";

// Documents table - stores uploaded budget documents
export const documents = pgTable(
  "documents",
  {
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
    chunkCount: integer("chunk_count").default(0),
  },
  (table) => [index("documents_fiscal_year_idx").on(table.fiscalYear)]
);

// Document chunks table - stores text chunks with embeddings
export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }), // text-embedding-004
    sha256Hash: text("sha256_hash").notNull(),
    merkleProof: jsonb("merkle_proof").notNull(), // Array of sibling hashes
    metadata: jsonb("metadata").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("chunks_document_id_idx").on(table.documentId),
    // Commenting out IVFFlat index as it was causing incomplete results on small datasets
    // index("chunks_embedding_idx").using(
    //   "ivfflat",
    //   table.embedding.op("vector_cosine_ops")
    // ),
  ]
);

// Query logs table - for analytics and audit trail
export const queryLogs = pgTable("query_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  query: text("query").notNull(),
  responseTime: integer("response_time"), // in ms
  chunksRetrieved: integer("chunks_retrieved"),
  tokensUsed: integer("tokens_used"),
  verified: text("verified").default("false"), // 'true' | 'false'
  timestamp: timestamp("timestamp").defaultNow(),
  userIp: text("user_ip"),
});

// Users table - for admin authentication
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").default("admin"), // 'admin' | 'viewer'
  createdAt: timestamp("created_at").defaultNow(),
});

// Types for TypeScript
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type NewDocumentChunk = typeof documentChunks.$inferInsert;
export type QueryLog = typeof queryLogs.$inferSelect;
export type User = typeof users.$inferSelect;
