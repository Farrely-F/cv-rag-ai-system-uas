import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Document {
  id: string;
  fileName: string;
  documentType: string;
  fiscalYear: number;
  source: string;
  uploadedBy: string;
  uploadedAt: string;
  merkleRoot: string;
  blockchainTxId: string;
  chunkCount: number;
  status: string;
  version?: number;
  previousId?: string | null;
}

interface DocumentsResponse {
  documents: Document[];
}

async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch("/api/documents");
  const data: DocumentsResponse = await res.json();
  return data.documents || [];
}

async function deleteDocument(
  docId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`/api/documents?id=${docId}`, {
    method: "DELETE",
  });
  return res.json();
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: fetchDocuments,
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      // Invalidate and refetch documents after deletion
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useInvalidateDocuments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["documents"] });
}
