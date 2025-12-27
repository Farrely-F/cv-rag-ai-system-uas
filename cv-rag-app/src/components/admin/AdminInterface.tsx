"use client";

import { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  ExternalLink,
  Loader2,
  XCircle,
  CheckCircle2,
  Trash2,
  RefreshCw,
  Edit,
  AlertTriangle,
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
import { TamperModal } from "./TamperModal";
import {
  useDocuments,
  useDeleteDocument,
  useInvalidateDocuments,
  type Document,
} from "@/hooks/use-documents";

interface ProgressEvent {
  step: string;
  progress: number;
  message: string;
  detail?: string;
}

interface IngestionResult {
  success: boolean;
  documentId?: string;
  chunksProcessed?: number;
  merkleRoot?: string;
  blockchainTxId?: string;
  processingTimeMs?: number;
  error?: string;
}

const STEPS = [
  { id: "extracting", label: "Extract PDF" },
  { id: "chunking", label: "Split Chunks" },
  { id: "hashing", label: "Hash Chunks" },
  { id: "merkle", label: "Merkle Tree" },
  { id: "embedding", label: "Embeddings" },
  { id: "blockchain", label: "Blockchain" },
  { id: "database", label: "Save Document" },
  { id: "chunks", label: "Save Chunks" },
  { id: "complete", label: "Complete" },
];

export function AdminInterface() {
  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<string>("APBN");
  const [fiscalYear, setFiscalYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [source, setSource] = useState<string>("Ministry of Finance");
  const [chunkingStrategy, setChunkingStrategy] = useState<string>("semantic");
  const [highQuality, setHighQuality] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentProgress, setCurrentProgress] = useState<ProgressEvent | null>(
    null
  );
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [parentDocumentId, setParentDocumentId] = useState<string | null>(null);

  // Document list (React Query)
  const {
    data: documents = [],
    isLoading: isLoadingDocs,
    isRefetching,
  } = useDocuments();
  const deleteDocumentMutation = useDeleteDocument();
  const invalidateDocuments = useInvalidateDocuments();

  const MAX_DOCS = documents.length === 1;

  // Tampering state
  const [tamperModalOpen, setTamperModalOpen] = useState(false);
  const [selectedDocForTamper, setSelectedDocForTamper] =
    useState<Document | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setResult(null);
      setCurrentProgress(null);
      setCompletedSteps([]);
      setParentDocumentId(null); // Clear parent if a new file is manualy picked
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsUploading(false);
      setCurrentProgress(null);
      setResult({
        success: false,
        error: "Processing was cancelled by user",
      });
    }
  };

  const handleDelete = async (docId: string, fileName: string) => {
    if (!confirm(`Delete "${fileName}" and all its chunks?`)) return;
    deleteDocumentMutation.mutate(docId, {
      onError: () => alert("Failed to delete document"),
    });
  };

  const handleReprocess = (doc: Document) => {
    // Populate form with doc metadata
    setDocumentType(doc.documentType);
    setFiscalYear(doc.fiscalYear.toString());
    setSource(doc.source);
    setParentDocumentId(doc.id);
    setResult(null);

    // Scroll to upload form
    const formElement = document.getElementById("upload-form");
    if (formElement) {
      formElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setResult(null);
    setCurrentProgress(null);
    setCompletedSteps([]);

    abortControllerRef.current = new AbortController();

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", documentType);
      formData.append("fiscalYear", fiscalYear);
      formData.append("source", source);
      formData.append("chunkingStrategy", chunkingStrategy);
      formData.append("highQuality", highQuality.toString());
      if (parentDocumentId) {
        formData.append("parentDocumentId", parentDocumentId);
      }

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: ProgressEvent = JSON.parse(line.slice(6));
              setCurrentProgress(event);

              if (event.step !== "error") {
                setCompletedSteps((prev) =>
                  prev.includes(event.step) ? prev : [...prev, event.step]
                );
              }

              if (event.step === "complete" && event.detail) {
                const finalResult = JSON.parse(event.detail);
                setResult(finalResult);
                setFile(null);
                setParentDocumentId(null); // Clear after success
                invalidateDocuments(); // Refresh document list
              }

              if (event.step === "error") {
                setResult({
                  success: false,
                  error: event.detail || event.message,
                });
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setResult({
          success: false,
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Document Management</h1>
          <p className="mt-1 text-muted-foreground">
            Upload, view, and manage budget documents for the CV-RAG system
          </p>
        </div>

        {/* Document List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Uploaded Documents</CardTitle>
              <CardDescription>
                {documents.length} document(s) in database
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={invalidateDocuments}
              disabled={isLoadingDocs || isRefetching}
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isLoadingDocs || isRefetching ? "animate-spin" : ""
                }`}
              />
            </Button>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>No documents uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{doc.fileName}</span>
                        <Badge variant="secondary">{doc.documentType}</Badge>
                        <Badge variant="outline">{doc.fiscalYear}</Badge>
                        {doc.version && doc.version > 1 && (
                          <Badge className="bg-blue-500 hover:bg-blue-600">
                            v{doc.version}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{doc.chunkCount} chunks</span>
                        <span>•</span>
                        <span>{doc.source}</span>
                        <span>•</span>
                        <span>
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </span>
                        {doc.blockchainTxId && (
                          <>
                            <span>•</span>
                            <a
                              href={`https://sepolia.basescan.org/tx/${doc.blockchainTxId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              Blockchain <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDocForTamper(doc);
                          setTamperModalOpen(true);
                        }}
                        title="Simulate Tampering (for demonstration)"
                        className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                      >
                        <AlertTriangle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReprocess(doc)}
                        title="Re-process Document (Create new version)"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(doc.id, doc.fileName)}
                        disabled={deleteDocumentMutation.isPending}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        {deleteDocumentMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Form */}
        {!MAX_DOCS && (
          <Card>
            <CardHeader>
              <CardTitle>Upload New Document</CardTitle>
              <CardDescription>anchored on the blockchain.</CardDescription>
            </CardHeader>
            <CardContent id="upload-form">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Version indicator for update */}
                {parentDocumentId && (
                  <Alert className="bg-blue-50 border-blue-200 text-blue-800">
                    <RefreshCw className="h-4 w-4" />
                    <AlertTitle>Updating Document</AlertTitle>
                    <AlertDescription>
                      You are creating a new version of an existing document.
                      This will maintain the audit trail of previous versions.
                      <Button
                        variant="link"
                        className="h-auto p-0 ml-2"
                        onClick={() => setParentDocumentId(null)}
                      >
                        Cancel update and upload as new
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
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
                        <SelectItem value="APBN">
                          APBN (State Budget)
                        </SelectItem>
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

                {/* Chunking Strategy */}
                <div className="space-y-2">
                  <Label htmlFor="chunkingStrategy">Chunking Strategy</Label>
                  <Select
                    value={chunkingStrategy}
                    onValueChange={(value) =>
                      value && setChunkingStrategy(value)
                    }
                    disabled={isUploading}
                  >
                    <SelectTrigger id="chunkingStrategy">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semantic">
                        Semantic (Recommended) - Smart splitting at natural
                        boundaries
                      </SelectItem>
                      <SelectItem value="fixed">
                        Fixed Length - Split by character count
                      </SelectItem>
                      <SelectItem value="sentence">
                        Sentence-based - Groups of 3-4 sentences
                      </SelectItem>
                      <SelectItem value="paragraph">
                        Paragraph-based - One paragraph per chunk
                      </SelectItem>
                      <SelectItem value="page">
                        Page-based - Roughly one page per chunk
                      </SelectItem>
                      <SelectItem value="agentic">
                        Agentic (AI-powered) - LLM identifies topic boundaries
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* High Quality Toggle */}
                <div className="flex items-center space-x-2 rounded-lg border p-4 bg-primary/5">
                  <input
                    type="checkbox"
                    id="highQuality"
                    checked={highQuality}
                    onChange={(e) => setHighQuality(e.target.checked)}
                    disabled={isUploading}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="highQuality"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      High-Quality AI Extraction
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Uses Gemini 2.0 to perfectly extract tables and structured
                      text. Recommended for complex budget documents. (May take
                      30-60s)
                    </p>
                  </div>
                </div>

                {/* Progress Steps */}
                {isUploading && currentProgress && (
                  <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{currentProgress.message}</p>
                        {currentProgress.detail && (
                          <p className="text-sm text-muted-foreground">
                            {currentProgress.detail}
                          </p>
                        )}
                      </div>
                      <span className="text-lg font-bold">
                        {currentProgress.progress}%
                      </span>
                    </div>
                    <Progress value={currentProgress.progress} />

                    {/* Step indicators */}
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                      {STEPS.slice(0, -1).map((step) => {
                        const isCompleted = completedSteps.includes(step.id);
                        const isCurrent = currentProgress.step === step.id;
                        return (
                          <div
                            key={step.id}
                            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
                              isCompleted
                                ? "bg-green-500/10 text-green-600"
                                : isCurrent
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : isCurrent ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <div className="h-3 w-3 rounded-full border" />
                            )}
                            <span className="hidden truncate sm:inline">
                              {step.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={!file || isUploading}
                    className="flex-1"
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

                  {isUploading && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAbort}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

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
      </div>

      {/* Tamper Modal */}
      {selectedDocForTamper && (
        <TamperModal
          isOpen={tamperModalOpen}
          onClose={() => {
            setTamperModalOpen(false);
            setSelectedDocForTamper(null);
          }}
          documentId={selectedDocForTamper.id}
          documentName={selectedDocForTamper.fileName}
        />
      )}
    </div>
  );
}
