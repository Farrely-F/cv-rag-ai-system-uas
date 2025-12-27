"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useRef, useEffect } from "react";
import { Send, Shield, Database, Terminal, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { MemoizedMarkdown } from "./memoized-markdown";
import { BudgetSources } from "./BudgetSources";
import { DefaultChatTransport } from "ai";

// Available LLM models
const AVAILABLE_MODELS = [
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash (Exp)",
    speed: "⚡ Fast",
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    speed: "⚡ Fast",
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    speed: "⚡ Fast",
  },
  { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", speed: "⚡ Fast" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", speed: "🧠 Most Capable" },
] as const;

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
  const [selectedModel, setSelectedModel] = useState<string>(
    AVAILABLE_MODELS[0].id
  );
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [error, setError] = useState<{
    message: string;
    retryAfter?: number;
  } | null>(null);

  // Use ref to avoid closure issues in transport
  const modelRef = useRef(selectedModel);

  // Update ref when model changes
  useEffect(() => {
    modelRef.current = selectedModel;
    console.log("Model updated to:", selectedModel);
  }, [selectedModel]);

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ id, messages }) => {
        console.log("Sending request with model:", modelRef.current);
        return {
          body: {
            id,
            messages,
            model: modelRef.current, // Use ref to get latest value
          },
        };
      },
    }),
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

  // // Wrap sendMessage to include model
  // const sendMessage = (message: { text: string }) => {
  //   originalSendMessage({
  //     ...message,
  //     experimental_attachments: [],
  //     data: { model: selectedModel },
  //   } as );
  // };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    setError(null); // Clear any previous error
    sendMessage({ text: inputValue });
    setInputValue("");
  };

  return (
    <div className="flex h-screen flex-col bg-transparent font-mono relative overflow-hidden">
      {/* Decorative Grid Lines */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md px-6 py-4 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center border border-primary/50 bg-primary/10 text-primary animate-pulse">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-widest uppercase text-primary">
                CV-RAG{" "}
                <span className="text-xs align-top opacity-50">v1.0</span>
              </h1>
              <p className="text-xs text-muted-foreground tracking-wider uppercase">
                Secure Budget Analysis Terminal
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {/* Model Selector */}
            <div className="relative">
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-2 border border-primary/30 bg-primary/5 px-3 py-1.5 hover:bg-primary/10 transition-all uppercase tracking-wider text-[10px]"
              >
                <Settings className="h-3 w-3" />
                <span className="text-primary">
                  {AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.name ||
                    "Model"}
                </span>
              </button>

              {showModelSelector && (
                <div className="absolute right-0 top-full mt-2 w-64 border border-primary/30 bg-background/95 backdrop-blur-md shadow-lg z-50">
                  <div className="p-2 border-b border-primary/20 text-[10px] uppercase tracking-widest text-primary">
                    Select LLM Model
                  </div>
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setShowModelSelector(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-xs transition-all",
                        selectedModel === model.id
                          ? "bg-primary/20 text-primary"
                          : "hover:bg-primary/10 text-foreground"
                      )}
                    >
                      <div className="font-semibold">{model.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {model.speed}
                      </div>
                    </button>
                  ))}
                  <div className="p-2 border-t border-primary/20 text-[9px] text-muted-foreground italic">
                    Switch models if you encounter rate limits
                  </div>
                </div>
              )}
            </div>

            <span className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>{" "}
              SYSTEM ONLINE
            </span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 z-0 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
        <div className="mx-auto max-w-5xl space-y-8 py-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border/50 p-10 bg-background/30 backdrop-blur-sm">
              <Terminal className="mb-6 h-20 w-20 text-primary/40" />
              <h2 className="text-2xl font-bold uppercase tracking-widest text-foreground">
                Initiate Inquiry
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground font-light">
                Submit queries regarding Indonesian Budget (APBN). All responses
                are cryptographically signed and verified.
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                {[
                  "Education Budget",
                  "Healthcare Allocation",
                  "Infrastructure Spending",
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setInputValue(`What was the ${tag}?`)}
                    className="border border-primary/20 bg-primary/5 px-4 py-3 text-xs uppercase tracking-wider hover:bg-primary/20 hover:border-primary transition-all text-primary/80 hover:text-primary"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-4 backdrop-blur-sm">
              <div className="text-destructive animate-pulse">⚠️</div>
              <div className="flex-1">
                <p className="font-bold text-destructive uppercase text-sm tracking-wider">
                  System Error: Rate Limit Exceeded
                </p>
                <p className="text-xs text-destructive/80 mt-1">
                  {error.message}
                </p>
                {error.retryAfter && (
                  <p className="mt-2 text-xs font-mono text-destructive">
                    Retry available in {error.retryAfter}s
                  </p>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="text-destructive hover:text-destructive-foreground"
              >
                ✕
              </button>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-6",
                message.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center border font-bold text-xs",
                  message.role === "assistant"
                    ? "border-primary text-primary bg-primary/10"
                    : "border-secondary-foreground/30 text-secondary-foreground bg-secondary/10"
                )}
              >
                {message.role === "assistant" ? "AI" : "USR"}
              </div>

              <div
                className={cn(
                  "max-w-[85%] space-y-3",
                  message.role === "user" && "items-end flex flex-col"
                )}
              >
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <div
                          key={`${message.id}-${i}`}
                          className={cn(
                            "p-4 border backdrop-blur-sm",
                            message.role === "user"
                              ? "bg-secondary/20 border-border text-foreground"
                              : "bg-primary/5 border-primary/20 text-foreground"
                          )}
                        >
                          <MemoizedMarkdown
                            id={`${message.id}-${i}`}
                            content={part.text}
                          />
                        </div>
                      );

                    case "tool-searchBudgetDocuments":
                      const toolPart = part as {
                        output?: SearchResult;
                        state?: string;
                      };
                      const result = toolPart.output;

                      if (!result) {
                        return (
                          <div
                            key={`${message.id}-${i}`}
                            className="border border-dashed border-primary/30 p-3 flex items-center gap-3 bg-background/50"
                          >
                            <Spinner className="h-4 w-4 text-primary" />
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                              Accessing Secure Archives...
                            </span>
                          </div>
                        );
                      }

                      if (!result.found) {
                        return (
                          <div
                            key={`${message.id}-${i}`}
                            className="border border-dashed border-amber-500/30 p-3 flex items-center gap-3 bg-amber-500/5"
                          >
                            <Database className="h-4 w-4 text-amber-500" />
                            <span className="text-xs uppercase tracking-wider text-amber-500/80">
                              {result.message || "Data Retrieval Failed"}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <BudgetSources
                          key={`${message.id}-${i}`}
                          result={result}
                        />
                      );

                    default:
                      return null;
                  }
                })}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-6">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-primary text-primary bg-primary/10 font-bold text-xs animate-pulse">
                AI
              </div>
              <div className="border border-dashed border-primary/30 p-4 bg-background/50 flex items-center gap-3">
                <div className="h-2 w-2 bg-primary animate-ping rounded-full"></div>
                <span className="text-xs text-primary uppercase tracking-widest">
                  Processing Query...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-background/90 backdrop-blur-md px-6 py-6 z-10">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex max-w-5xl items-center gap-4"
        >
          <div className="relative flex-1 group">
            <div className="absolute -inset-0.5 bg-primary/10 blur opacity-0 group-focus-within:opacity-100 transition duration-500"></div>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="ENTER COMMAND OR QUERY..."
              disabled={isLoading}
              className="relative bg-background border-primary/30 focus-visible:ring-0 focus-visible:border-primary text-primary placeholder:text-primary/30"
            />
          </div>
          <Button
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            variant="default"
            size="icon"
            className="rounded-none border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Transmit</span>
          </Button>
        </form>
        <div className="mx-auto mt-2 max-w-5xl flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">
          <span>Secure Connection: Encrypted</span>
          {/* <span>Latency: 12ms</span> */}
        </div>
      </div>
    </div>
  );
}
