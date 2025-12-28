import { useQuery } from "@tanstack/react-query";

export interface DbStats {
  sizeBytes: number;
  sizeHuman: string;
  usedPercentage: number;
  freePercentage: number;
  maxSizeHuman: string;
}

async function fetchDbStats(): Promise<DbStats> {
  const res = await fetch("/api/db-stats");
  if (!res.ok) {
    throw new Error("Failed to fetch database stats");
  }
  return res.json();
}

export function useDbStats() {
  return useQuery({
    queryKey: ["db-stats"],
    queryFn: fetchDbStats,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 20000, // Consider data stale after 20 seconds
  });
}
