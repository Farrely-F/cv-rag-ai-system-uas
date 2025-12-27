"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Shield,
  ExternalLink,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  verifySource,
  type VerifiableSource,
  type SourceVerification,
} from "@/lib/verification";

interface VerificationPanelProps {
  sources: VerifiableSource[];
}

export function VerificationPanel({ sources }: VerificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResults, setVerificationResults] = useState<
    SourceVerification[]
  >([]);

  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const results = await Promise.all(sources.map(verifySource));
      setVerificationResults(results);
    } catch (error) {
      console.error("Verification failed:", error);
    } finally {
      setIsVerifying(false);
    }
  };

  if (sources.length === 0) return null;

  const allVerified =
    verificationResults.length > 0 &&
    verificationResults.every((r) => r.verified);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-dashed">
        <CollapsibleTrigger
          className="w-full cursor-pointer"
          onClick={() => setIsOpen(!isOpen)}
        >
          <CardHeader className="py-3 hover:bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">
                  Verify Answer ({sources.length} sources)
                </CardTitle>
                {verificationResults.length > 0 && (
                  <Badge variant={allVerified ? "default" : "destructive"}>
                    {allVerified ? "✓ Verified" : "✗ Issues Found"}
                  </Badge>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Sources List */}
            <div className="space-y-4 max-h-60 overflow-y-auto scrollbar-thin pr-2">
              {sources.map((source, index) => (
                <div
                  key={source.chunkId}
                  className="rounded-lg border-l-2 border-primary/30 bg-muted/30 p-3"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-medium">
                        Source {index + 1}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {source.documentMetadata.fileName} (
                        {source.documentMetadata.fiscalYear})
                      </p>
                    </div>
                    {verificationResults[index] && (
                      <div className="flex items-center gap-1">
                        {verificationResults[index].verified ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Cryptographic Details */}
                  <div className="space-y-1 font-mono text-xs text-muted-foreground">
                    <div className="flex gap-2">
                      <span className="text-muted-foreground/70">Hash:</span>
                      <span className="truncate">
                        {source.chunkHash.slice(0, 24)}...
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-muted-foreground/70">Root:</span>
                      <span className="truncate">
                        {source.merkleRoot.slice(0, 24)}...
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground/70">TX:</span>
                      <a
                        href={`https://sepolia.basescan.org/tx/${source.blockchainTxId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {source.blockchainTxId.slice(0, 16)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Verification Error */}
                  {verificationResults[index] &&
                    !verificationResults[index].verified && (
                      <p className="mt-2 text-xs text-destructive">
                        {verificationResults[index].error}
                      </p>
                    )}
                </div>
              ))}
            </div>

            {/* Verify Button */}
            <Button
              onClick={handleVerify}
              disabled={isVerifying}
              className="w-full"
              variant="outline"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : verificationResults.length > 0 ? (
                <>
                  <Shield className="h-4 w-4" />
                  Re-verify
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Run Cryptographic Verification
                </>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Verification checks: SHA-256 hash → Merkle proof → Blockchain
              anchor
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
