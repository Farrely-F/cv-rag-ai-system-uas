"use client";

import {
  AlertTriangle,
  Check,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChunks, useTamperChunk, useRestoreChunk } from "@/hooks/use-chunks";

interface TamperModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
}

export function TamperModal({
  isOpen,
  onClose,
  documentId,
  documentName,
}: TamperModalProps) {
  const {
    data: chunks = [],
    isLoading,
    isRefetching,
  } = useChunks(documentId, {
    enabled: isOpen,
  });
  const tamperMutation = useTamperChunk(documentId);
  const restoreMutation = useRestoreChunk(documentId);

  const handleTamper = (chunkId: string) => {
    tamperMutation.mutate(chunkId, {
      onError: () => alert("Failed to tamper chunk"),
    });
  };

  const handleRestore = (chunkId: string) => {
    restoreMutation.mutate(chunkId, {
      onError: () => alert("Failed to restore chunk"),
    });
  };

  const tamperedCount = chunks.filter((c) => c.isTampered).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Simulate Tampering
          </DialogTitle>
          <DialogDescription>
            Modify chunk content to simulate unauthorized changes. Tampered
            chunks will fail verification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div>
              <p className="font-medium">{documentName}</p>
              <p className="text-xs text-muted-foreground">
                {chunks.length} chunks total
              </p>
            </div>
            {tamperedCount > 0 && (
              <Badge variant="destructive">{tamperedCount} tampered</Badge>
            )}
          </div>

          <ScrollArea className="h-[400px] rounded-lg">
            {isLoading || isRefetching ? (
              <div className="flex items-center justify-center w-full h-full p-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className={`rounded-lg border p-3 ${
                      chunk.isTampered
                        ? "border-red-500/50 bg-red-50/50 dark:bg-red-950/20"
                        : "bg-background"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            Chunk #{chunk.chunkIndex + 1}
                          </span>
                          {chunk.isTampered ? (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              Tampered
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs text-green-600"
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Original
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {chunk.contentPreview}...
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {chunk.isTampered ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(chunk.id)}
                            disabled={restoreMutation.isPending}
                            className="text-green-600 hover:bg-green-50"
                          >
                            {restoreMutation.isPending &&
                            restoreMutation.variables === chunk.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="h-4 w-4" />
                                Restore
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTamper(chunk.id)}
                            disabled={tamperMutation.isPending}
                            className="text-amber-600 hover:bg-amber-50"
                          >
                            {tamperMutation.isPending &&
                            tamperMutation.variables === chunk.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <AlertTriangle className="h-4 w-4" />
                                Tamper
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        <DialogFooter className="sm:justify-center">
          <p className="text-xs text-center text-muted-foreground">
            ⚠️ Tampered chunks will show &quot;Chunk hash mismatch&quot; during
            verification
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
