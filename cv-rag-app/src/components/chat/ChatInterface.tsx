"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Send, Shield, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { VerificationPanel } from "./VerificationPanel";
import type { VerifiableSource } from "@/lib/verification";
import { cn } from "@/lib/utils";

export function ChatInterface() {
  const [inputValue, setInputValue] = useState("");
  const [sources, setSources] = useState<VerifiableSource[]>([]);

  const { messages, sendMessage, status } = useChat();

  const isLoading = status === "streaming" || status === "submitted";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
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

          {messages.map((message, index) => (
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
                <Card
                  className={cn(
                    message.role === "user" && "border-primary/20 bg-primary/5"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.parts.map((part, i) => {
                        switch (part.type) {
                          case "text":
                            return (
                              <span key={`${message.id}-${i}`}>
                                {part.text}
                              </span>
                            );
                          default:
                            return null;
                        }
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Verification Panel for last assistant message */}
                {message.role === "assistant" &&
                  index === messages.length - 1 &&
                  !isLoading &&
                  sources.length > 0 && <VerificationPanel sources={sources} />}
              </div>

              {message.role === "user" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <Card>
                <CardContent className="flex items-center gap-2 p-4">
                  <Spinner className="h-4 w-4" />
                  <span className="text-sm text-muted-foreground">
                    Searching documents...
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
          Answers are generated from official APBN documents and can be
          independently verified using blockchain proofs.
        </p>
      </div>
    </div>
  );
}
