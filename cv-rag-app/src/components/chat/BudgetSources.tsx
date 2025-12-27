"use client";

import { useState } from "react";
import { Database, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { VerificationPanel } from "./VerificationPanel";
import { VerifiableSource } from "@/lib/verification";

// Types corresponding to what was in ChatInterface
interface BudgetSource {
  chunkId: string;
  content: string;
  similarity: number;
  document: {
    fileName: string;
    fiscalYear: number;
    source: string;
  };
  chunkHash: string;
  merkleProof: string[];
  merkleRoot: string;
  blockchainTxId: string;
}

interface SearchResult {
  found: boolean;
  context?: string;
  message?: string;
  sources: BudgetSource[];
}

interface BudgetSourcesProps {
  result: SearchResult;
}

export function BudgetSources({ result }: BudgetSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!result.found || result.sources.length === 0) return null;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="border border-primary/20 bg-primary/5 w-full"
    >
      <div className="bg-primary/10 px-3 py-2 border-b border-primary/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-3 w-3 text-primary" />
          <span className="text-xs font-bold text-primary uppercase">
            Data Sources Retrieved: {result.sources.length}
          </span>
        </div>
        <CollapsibleTrigger className="hover:bg-primary/10 p-1 rounded transition-colors">
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-primary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-primary" />
          )}
          <span className="sr-only">Toggle Sources</span>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <div className="p-3 space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
          {result.sources.map((source, idx) => (
            <div
              key={source.chunkId}
              className="group relative border-l-2 border-primary/40 pl-3 py-1 hover:bg-primary/5 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div className="text-xs font-medium text-primary/90">
                  [{idx + 1}] {source.document.fileName}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {source.document.fiscalYear} •{" "}
                  {(source.similarity * 100).toFixed(0)}% Match
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2 italic font-sans opacity-80 group-hover:opacity-100">
                &quot;{source.content.slice(0, 150)}...&quot;
              </div>
            </div>
          ))}
        </div>

        {/* Verification Panel */}
        <div className="border-t border-primary/20 p-3 bg-background/30">
          <VerificationPanel
            sources={
              result.sources.map((s) => ({
                ...s,
                documentMetadata: {
                  fileName: s.document.fileName,
                  fiscalYear: s.document.fiscalYear,
                  source: s.document.source,
                },
              })) as VerifiableSource[]
            }
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
