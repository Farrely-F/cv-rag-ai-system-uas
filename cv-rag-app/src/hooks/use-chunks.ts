import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ChunkInfo {
  id: string;
  chunkIndex: number;
  contentPreview: string;
  isTampered: boolean;
  tamperedAt: string | null;
}

interface ChunksResponse {
  chunks: ChunkInfo[];
}

async function fetchChunks(documentId: string): Promise<ChunkInfo[]> {
  const res = await fetch(`/api/documents/tamper?documentId=${documentId}`);
  const data: ChunksResponse = await res.json();
  return data.chunks || [];
}

interface TamperRestoreParams {
  chunkId: string;
  action: "tamper" | "restore";
}

async function tamperOrRestoreChunk(
  params: TamperRestoreParams
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch("/api/documents/tamper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}

export function useChunks(documentId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["chunks", documentId],
    queryFn: () => fetchChunks(documentId),
    enabled: options?.enabled ?? true,
  });
}

export function useTamperChunk(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chunkId: string) =>
      tamperOrRestoreChunk({ chunkId, action: "tamper" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chunks", documentId] });
    },
  });
}

export function useRestoreChunk(documentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chunkId: string) =>
      tamperOrRestoreChunk({ chunkId, action: "restore" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chunks", documentId] });
    },
  });
}
