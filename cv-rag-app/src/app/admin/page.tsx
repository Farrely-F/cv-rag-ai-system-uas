"use client";

import { useState } from "react";
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface IngestionResult {
  success: boolean;
  documentId?: string;
  chunksProcessed?: number;
  merkleRoot?: string;
  blockchainTxId?: string;
  processingTimeMs?: number;
  error?: string;
}

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("APBN");
  const [fiscalYear, setFiscalYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [source, setSource] = useState<string>("Ministry of Finance");
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<IngestionResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setProgress(10);
    setResult(null);

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);
      formData.append("fiscalYear", fiscalYear);
      formData.append("source", source);

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setProgress(100);

      const data = await response.json();
      setResult(data);

      if (data.success) {
        setFile(null);
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Upload failed",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Document Management</h1>
          <p className="mt-1 text-muted-foreground">
            Upload and process budget documents for the CV-RAG system
          </p>
        </div>

        {/* Upload Form */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Upload a PDF document to process. The document will be chunked,
              embedded, and anchored on the blockchain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="file">PDF Document</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                </div>
                {file && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{file.name}</span>
                    <Badge variant="secondary">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {/* Document Type */}
                <div className="space-y-2">
                  <Label htmlFor="documentType">Document Type</Label>
                  <Select
                    value={documentType}
                    onValueChange={(value) => value && setDocumentType(value)}
                    disabled={isUploading}
                  >
                    <SelectTrigger id="documentType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="APBN">APBN (State Budget)</SelectItem>
                      <SelectItem value="APBD">
                        APBD (Regional Budget)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Fiscal Year */}
                <div className="space-y-2">
                  <Label htmlFor="fiscalYear">Fiscal Year</Label>
                  <Select
                    value={fiscalYear}
                    onValueChange={(value) => value && setFiscalYear(value)}
                    disabled={isUploading}
                  >
                    <SelectTrigger id="fiscalYear">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Source */}
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Input
                    id="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g., Ministry of Finance"
                    disabled={isUploading}
                  />
                </div>
              </div>

              {/* Progress */}
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Processing document...</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={!file || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload and Process
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Result */}
        {result && (
          <Alert variant={result.success ? "default" : "error"}>
            {result.success ? (
              <Check className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.success ? "Document Processed" : "Processing Failed"}
            </AlertTitle>
            <AlertDescription>
              {result.success ? (
                <div className="mt-2 space-y-2">
                  <p>
                    Successfully processed{" "}
                    <strong>{result.chunksProcessed} chunks</strong> in{" "}
                    {((result.processingTimeMs || 0) / 1000).toFixed(1)}{" "}
                    seconds.
                  </p>
                  <div className="space-y-1 font-mono text-xs">
                    <div>
                      <span className="text-muted-foreground">
                        Document ID:
                      </span>{" "}
                      {result.documentId}
                    </div>
                    <div>
                      <span className="text-muted-foreground">
                        Merkle Root:
                      </span>{" "}
                      {result.merkleRoot?.slice(0, 32)}...
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">
                        Blockchain TX:
                      </span>
                      <a
                        href={`https://sepolia.basescan.org/tx/${result.blockchainTxId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        {result.blockchainTxId?.slice(0, 24)}...
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <p>{result.error}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Info Card */}
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-2 text-sm text-muted-foreground">
              <li>PDF is parsed and text is extracted</li>
              <li>Text is split into semantic chunks (~1000 tokens each)</li>
              <li>Each chunk is hashed with SHA-256</li>
              <li>Hashes are combined into a Merkle tree</li>
              <li>Merkle root is anchored on Base Sepolia blockchain</li>
              <li>Chunks are embedded with text-embedding-004</li>
              <li>Everything is stored in the database for RAG retrieval</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
