// Type definitions for search tool output
interface BudgetDocumentMetadata {
  fileName: string;
  fiscalYear: number;
  source: string;
}

interface BudgetSource {
  chunkId: string;
  content: string;
  similarity: number;
  document: BudgetDocumentMetadata;
  chunkHash: string;
  merkleProof: string[];
  merkleRoot: string;
  blockchainTxId: string;
}

interface SearchToolOutput {
  found: boolean;
  message?: string;
  context?: string;
  sources: BudgetSource[];
}

interface TrimmedBudgetSource {
  chunkId: string;
  similarity: number;
  document: BudgetDocumentMetadata;
}

interface TrimmedSearchToolOutput {
  found: boolean;
  message?: string;
  context?: string;
  sources: TrimmedBudgetSource[];
}
