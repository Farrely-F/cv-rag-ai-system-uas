"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Send, Shield, Bot, User, Database, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { MemoizedMarkdown } from "./memoized-markdown";
import { VerificationPanel } from "./VerificationPanel";
import { VerifiableSource } from "@/lib/verification";

// Types for tool results
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

export function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<{
    message: string;
    retryAfter?: number;
  } | null>(null);

  const { messages, sendMessage, status } = useChat({
    onError: (err) => {
      // Try to parse error response
      try {
        const errorData = JSON.parse(err.message);
        if (errorData.error === "rate_limit") {
          setError({
            message: errorData.message,
            retryAfter: errorData.retryAfter,
          });
        } else {
          setError({ message: errorData.message || "Something went wrong" });
        }
      } catch {
        setError({ message: err.message || "Failed to send message" });
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    setError(null); // Clear any previous error
    sendMessage({ text: inputValue });
    setInputValue("");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">CV-RAG Budget Chatbot</h1>
            <p className="text-sm text-muted-foreground">
              Cryptographically Verifiable Answers
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto max-w-4xl space-y-6 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Shield className="mb-4 h-16 w-16 text-muted-foreground/50" />
              <h2 className="text-xl font-semibold">
                Ask about Indonesian Budget (APBN)
              </h2>
              <p className="mt-2 max-w-md text-muted-foreground">
                Every answer is cryptographically verifiable and traceable to
                official documents anchored on blockchain.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Badge variant="secondary">Education Budget 2023</Badge>
                <Badge variant="secondary">Healthcare Allocation</Badge>
                <Badge variant="secondary">Infrastructure Spending</Badge>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Card className="border-red-500/50 bg-red-50/50 dark:bg-red-950/20">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/50">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-red-800 dark:text-red-200">
                    Rate Limit Exceeded
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {error.message}
                  </p>
                  {error.retryAfter && (
                    <p className="mt-1 text-xs text-red-500">
                      Wait ~{error.retryAfter}s before trying again
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </CardContent>
            </Card>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-4",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[80%] space-y-3",
                  message.role === "user" && "text-right"
                )}
              >
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <Card
                          key={`${message.id}-${i}`}
                          className={cn(
                            message.role === "user" &&
                              "border-primary/20 bg-primary/5"
                          )}
                        >
                          <CardContent className="p-4">
                            <MemoizedMarkdown
                              id={`${message.id}-${i}`}
                              content={part.text}
                            />
                          </CardContent>
                        </Card>
                      );

                    case "tool-searchBudgetDocuments":
                      // Access output from tool part - check if output exists
                      const toolPart = part as {
                        output?: SearchResult;
                        state?: string;
                      };
                      // Show result if output exists
                      const result = toolPart.output;

                      // Show loading only if no output yet
                      if (!result) {
                        return (
                          <Card
                            key={`${message.id}-${i}`}
                            className="border-dashed"
                          >
                            <CardContent className="flex items-center gap-2 p-3">
                              <Spinner className="h-4 w-4" />
                              <span className="text-sm text-muted-foreground">
                                Searching budget documents...
                              </span>
                            </CardContent>
                          </Card>
                        );
                      }

                      if (!result.found) {
                        return (
                          <Card
                            key={`${message.id}-${i}`}
                            className="border-dashed border-amber-500/30"
                          >
                            <CardContent className="flex items-center gap-2 p-3">
                              <Database className="h-4 w-4 text-amber-500" />
                              <span className="text-sm text-muted-foreground">
                                {result.message || "No documents found"}
                              </span>
                            </CardContent>
                          </Card>
                        );
                      }

                      return (
                        <Card
                          key={`${message.id}-${i}`}
                          className="border-dashed border-green-500/30"
                        >
                          <CardContent className="space-y-3 p-3">
                            <div className="flex items-center gap-2">
                              <Database className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">
                                Found {result.sources.length} source(s)
                              </span>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-scroll">
                              {result.sources.map((source, idx) => (
                                <div
                                  key={source.chunkId}
                                  className="rounded-lg border-l-2 border-primary/30 bg-muted/30 p-2"
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="text-xs font-medium">
                                        [{idx + 1}] {source.document.fileName}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Year: {source.document.fiscalYear} •
                                        Similarity:{" "}
                                        {(source.similarity * 100).toFixed(1)}%
                                      </p>
                                    </div>
                                    {source.blockchainTxId && (
                                      <a
                                        href={`https://sepolia.basescan.org/tx/${source.blockchainTxId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {source.content.slice(0, 150)}...
                                  </p>
                                </div>
                              ))}
                            </div>

                            {/* Verification Panel */}
                            <div className="mt-4 pt-2 border-t border-dashed">
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
                          </CardContent>
                        </Card>
                      );

                    default:
                      return null;
                  }
                })}
              </div>

              {message.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <Card>
                <CardContent className="flex items-center gap-2 p-4">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">
                    Thinking...
                  </span>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t px-6 py-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-4xl items-center gap-3"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about the Indonesian budget (e.g., 'What was the education budget in 2023?')"
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !inputValue.trim()}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
        <p className="mx-auto mt-2 max-w-4xl text-center text-xs text-muted-foreground">
          The AI decides when to search documents. Simple questions are answered
          directly.
        </p>
      </div>
    </div>
  );
}
