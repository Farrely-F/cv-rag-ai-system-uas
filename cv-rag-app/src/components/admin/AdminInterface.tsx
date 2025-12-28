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
  Server,
  Database,
  Shield,
  Clock,
  HardDrive,
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
import { useDbStats } from "@/hooks/use-db-stats";

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

  // Database stats (React Query)
  const { data: dbStats } = useDbStats();

  // const MAX_DOCS = documents.length === 1;

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
    <div className="min-h-screen bg-transparent p-6 font-mono text-sm">
      {/* Decorative Grid Lines */}
      <div className="fixed inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:48px_48px] z-[-1]"></div>

      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-primary/20 pb-4">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <Server className="h-6 w-6" /> System Administration
            </h1>
            <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">
              Secure Document Sideloading & Verification Terminal
            </p>
          </div>
          <Badge
            variant="outline"
            className="h-8 border-primary/50 bg-primary/10 text-primary font-mono"
          >
            <div className="mr-2 h-2 w-2 animate-pulse rounded-full bg-green-500" />
            ADMIN ACCESS GRANTED
          </Badge>
        </div>

        {/* Dashboard Stats (Pseudo) */}
        {/* {!MAX_DOCS && ( */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-primary/20 bg-primary/5 p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-20">
              <Database className="w-12 h-12" />
            </div>
            <div className="text-xs text-muted-foreground uppercase">
              Database Status
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">
              Active
            </div>
            <div className="w-full bg-border h-1 mt-3">
              <div className="bg-green-500 h-full w-[98%]"></div>
            </div>
          </div>
          <div className="border border-primary/20 bg-primary/5 p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-20">
              <Shield className="w-12 h-12" />
            </div>
            <div className="text-xs text-muted-foreground uppercase">
              Blockchain Anchor
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">
              Base Sepolia
            </div>
            <div className="w-full bg-border h-1 mt-3">
              <div className="bg-primary h-full w-full animate-pulse"></div>
            </div>
          </div>
          <div className="border border-primary/20 bg-primary/5 p-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-20">
              <HardDrive className="w-12 h-12" />
            </div>
            <div className="text-xs text-muted-foreground uppercase">
              Database Size
            </div>
            <div className="text-2xl font-bold text-foreground mt-1">
              {dbStats ? dbStats.sizeHuman : "Loading..."}
            </div>
            <div className="w-full bg-border h-1 mt-3">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{ width: `${dbStats?.usedPercentage || 0}%` }}
              ></div>
            </div>
            {dbStats && (
              <div className="text-[10px] text-muted-foreground mt-1">
                {dbStats.usedPercentage}% of {dbStats.maxSizeHuman}
              </div>
            )}
          </div>
        </div>
        {/* )} */}

        {/* Document List */}
        <Card className="border-border bg-card/40 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/5">
            <div>
              <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2 not-italic">
                <FileText className="h-4 w-4" /> Uploaded Datasets
              </CardTitle>
              <CardDescription className="text-xs font-mono opacity-70">
                {documents.length} secure document(s) in vector database
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={invalidateDocuments}
              disabled={isLoadingDocs || isRefetching}
              className="h-8 border-primary/30 hover:bg-primary/20"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isLoadingDocs || isRefetching ? "animate-spin" : ""
                }`}
              />
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {documents.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground border border-dashed border-border/50 bg-background/50">
                <FileText className="mx-auto mb-4 h-12 w-12 opacity-20" />
                <p className="uppercase tracking-widest text-xs">
                  No documents uploaded
                </p>
                <p className="text-[10px] mt-1 opacity-50">
                  Upload a PDF to begin indexing
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-none border border-primary/20 p-4 bg-primary/5 hover:bg-primary/10 transition-colors group relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary opacity-50"></div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge
                          variant="outline"
                          className="border-primary/40 text-primary bg-primary/10 rounded-sm px-2"
                        >
                          PDF
                        </Badge>
                        <span className="font-bold text-foreground tracking-wide">
                          {doc.fileName}
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-sm text-[10px]"
                        >
                          {doc.documentType}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-sm border-white/10 text-[10px]"
                        >
                          {doc.fiscalYear}
                        </Badge>
                        {doc.version && doc.version > 1 && (
                          <Badge className="bg-info text-info-foreground rounded-sm text-[10px]">
                            v{doc.version}
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] text-muted-foreground uppercase tracking-wider">
                        <div className="flex items-center gap-1">
                          <HardDrive className="h-3 w-3" /> {doc.chunkCount}{" "}
                          chunks
                        </div>
                        <div className="flex items-center gap-1">
                          <Database className="h-3 w-3" /> {doc.source}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />{" "}
                          {new Date(doc.uploadedAt).toLocaleDateString()}
                        </div>
                        {doc.blockchainTxId && (
                          <a
                            href={`https://sepolia.basescan.org/tx/${doc.blockchainTxId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:text-primary-foreground transition-colors group/link"
                          >
                            <Shield className="h-3 w-3" /> VERIFIED{" "}
                            <ExternalLink className="h-2 w-2 opacity-50 group-hover/link:opacity-100" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDocForTamper(doc);
                          setTamperModalOpen(true);
                        }}
                        title="Simulate Tampering"
                        className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 h-8 rounded-none flex-1 md:flex-none"
                      >
                        <AlertTriangle className="h-3 w-3 mr-2" /> TAMPER
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReprocess(doc)}
                        title="New Version"
                        className="border-info/30 text-info hover:bg-info/10 h-8 rounded-none flex-1 md:flex-none"
                      >
                        <Edit className="h-3 w-3 mr-2" /> UPDATE
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(doc.id, doc.fileName)}
                        disabled={deleteDocumentMutation.isPending}
                        className="h-8 rounded-none flex-1 md:flex-none"
                      >
                        {deleteDocumentMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
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
        {/* {!MAX_DOCS && ( */}
        <Card className="border-border bg-card/40 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Upload className="w-32 h-32" />
          </div>
          <CardHeader className="border-b border-primary/10">
            <CardTitle className="uppercase tracking-wider text-sm flex items-center gap-2 not-italic">
              <Upload className="h-4 w-4" /> Ingest New Document
            </CardTitle>
            <CardDescription className="text-xs font-mono opacity-70">
              Secure pipeline: PDF → Vector Chunks → Merkle Hashing → Blockchain
              Anchor
            </CardDescription>
          </CardHeader>
          <CardContent id="upload-form" className="pt-6 relative z-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Version indicator for update */}
              {parentDocumentId && (
                <Alert className="bg-info/10 border-info/30 text-info">
                  <RefreshCw className="h-4 w-4" />
                  <AlertTitle>UPDATING DOCUMENT VERSION</AlertTitle>
                  <AlertDescription className="text-xs">
                    Audit trail will be preserved.
                    <Button
                      variant="link"
                      className="h-auto p-0 ml-2 text-info underline"
                      onClick={() => setParentDocumentId(null)}
                    >
                      CANCEL UPDATE
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {/* File Upload */}
              <div className="space-y-2">
                <Label
                  htmlFor="file"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Source File (PDF)
                </Label>
                <div className="border border-dashed border-primary/30 bg-primary/5 p-6 text-center hover:bg-primary/10 transition-colors cursor-pointer relative">
                  <input
                    id="file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {file ? (
                    <div className="flex flex-col items-center relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setResult(null);
                          setCurrentProgress(null);
                          setCompletedSteps([]);
                          // Reset the file input
                          const fileInput = document.getElementById(
                            "file"
                          ) as HTMLInputElement;
                          if (fileInput) fileInput.value = "";
                        }}
                        disabled={isUploading}
                        className="group absolute -top-2 -right-2 h-8 w-8 aspect-square p-0 rounded-full hover:bg-destructive/20"
                        title="Remove file"
                      >
                        <XCircle className="h-4 w-4 group-hover:text-destructive/50 text-destructive" />
                      </Button>
                      <FileText className="h-8 w-8 text-primary mb-2" />
                      <span className="font-bold text-primary">
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-muted-foreground">
                      <Upload className="h-8 w-8 mb-2 opacity-50" />
                      <span className="text-sm">
                        DRAG FILE HERE OR CLICK TO BROWSE
                      </span>
                      <span className="text-[10px] opacity-70 mt-1">
                        PDF Format Only. Max 10MB.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-3">
                {/* Document Type */}
                <div className="space-y-2">
                  <Label
                    htmlFor="documentType"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Document Type
                  </Label>
                  <Select
                    value={documentType}
                    onValueChange={(value) => value && setDocumentType(value)}
                    disabled={isUploading}
                  >
                    <SelectTrigger
                      id="documentType"
                      className="bg-background/50 border-input"
                    >
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
                  <Label
                    htmlFor="fiscalYear"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Fiscal Year
                  </Label>
                  <Select
                    value={fiscalYear}
                    onValueChange={(value) => value && setFiscalYear(value)}
                    disabled={isUploading}
                  >
                    <SelectTrigger
                      id="fiscalYear"
                      className="bg-background/50 border-input"
                    >
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
                  <Label
                    htmlFor="source"
                    className="text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    Source Organization
                  </Label>
                  <Input
                    id="source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g., MINISTRY OF FINANCE"
                    disabled={isUploading}
                    className="bg-background/50 border-input"
                  />
                </div>
              </div>

              {/* Chunking Strategy */}
              <div className="space-y-2">
                <Label
                  htmlFor="chunkingStrategy"
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Chunking Strategy
                </Label>
                <Select
                  value={chunkingStrategy}
                  onValueChange={(value) => value && setChunkingStrategy(value)}
                  disabled={isUploading}
                >
                  <SelectTrigger
                    id="chunkingStrategy"
                    className="bg-background/50 border-input"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semantic">
                      Semantic Analysis (Recommended)
                    </SelectItem>
                    <SelectItem value="fixed">
                      Fixed Length Character
                    </SelectItem>
                    <SelectItem value="sentence">Sentence Grouping</SelectItem>
                    <SelectItem value="paragraph">
                      Paragraph Separation
                    </SelectItem>
                    <SelectItem value="page">Page-Level Splitting</SelectItem>
                    <SelectItem value="agentic">
                      Agentic LLM Segmentation
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* High Quality Toggle */}
              <div className="flex items-center space-x-3 rounded-none border border-primary/20 bg-primary/5 p-4">
                <input
                  type="checkbox"
                  id="highQuality"
                  checked={highQuality}
                  onChange={(e) => setHighQuality(e.target.checked)}
                  disabled={isUploading}
                  className="h-4 w-4 rounded-none border-primary bg-transparent text-primary focus:ring-primary focus:ring-offset-0"
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor="highQuality"
                    className="text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-primary uppercase"
                  >
                    High-Fidelity Extraction (Gemini 2.0)
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Enable advanced layout analysis for complex tables and
                    grids. Adds ~30s processing time.
                  </p>
                </div>
              </div>

              {/* Progress Steps */}
              {isUploading && currentProgress && (
                <div className="space-y-4 rounded-none border border-primary/30 bg-black/20 p-4 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold uppercase text-primary animate-pulse">
                        &gt; {currentProgress.message}
                      </p>
                      {currentProgress.detail && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {currentProgress.detail}
                        </p>
                      )}
                    </div>
                    <span className="text-lg font-bold text-primary">
                      {currentProgress.progress}%
                    </span>
                  </div>
                  <Progress
                    value={currentProgress.progress}
                    className="h-1 rounded-none bg-primary/20"
                  />

                  {/* Step indicators */}
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 mt-4">
                    {STEPS.slice(0, -1).map((step) => {
                      const isCompleted = completedSteps.includes(step.id);
                      const isCurrent = currentProgress.step === step.id;
                      return (
                        <div
                          key={step.id}
                          className={`flex flex-col items-center gap-1 rounded-none p-2 border text-[10px] uppercase text-center transition-all ${
                            isCompleted
                              ? "bg-green-500/10 text-green-500 border-green-500/30"
                              : isCurrent
                              ? "bg-primary/20 text-primary border-primary animate-pulse"
                              : "bg-muted/10 text-muted-foreground border-transparent opacity-50"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : isCurrent ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                          )}
                          <span className="hidden sm:inline">{step.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="submit"
                  disabled={!file || isUploading}
                  className="flex-1 rounded-none bg-primary text-primary-foreground hover:bg-prundimary/90 uppercase tracking-widest font-bold h-12 text-sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      EXECUTING PIPELINE...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      INITIATE UPLOAD
                    </>
                  )}
                </Button>

                {isUploading && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleAbort}
                    className="rounded-none uppercase tracking-wider"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    ABORT
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
        {/* )} */}

        {/* Result */}
        {result && (
          <Alert
            variant={result.success ? "success" : "error"}
            className={`border ${
              result.success
                ? "border-green-500/50 bg-green-500/10"
                : "border-red-500/50 bg-red-500/10"
            }`}
          >
            {result.success ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-500" />
            )}
            <AlertTitle
              className={`uppercase tracking-wider font-bold ${
                result.success ? "text-green-500" : "text-red-500"
              }`}
            >
              {result.success
                ? "PIPELINE COMPLETED SUCCESSFULLY"
                : "PIPELINE EXECUTION FAILED"}
            </AlertTitle>
            <AlertDescription className="text-foreground/80">
              {result.success ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-xs uppercase opacity-70">
                      Performance Metrics
                    </p>
                    <div className="border border-green-500/30 bg-green-500/5 p-3">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs">Chunks Processed</span>
                        <span className="font-bold text-green-500">
                          {result.chunksProcessed}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs">Processing Time</span>
                        <span className="font-bold text-green-500">
                          {((result.processingTimeMs || 0) / 1000).toFixed(2)}s
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 font-mono text-[10px]">
                    <p className="text-xs uppercase opacity-70">
                      Verification Proofs
                    </p>
                    <div className="break-all border border-border p-2 bg-background/50">
                      <span className="text-muted-foreground">ID:</span>{" "}
                      {result.documentId}
                    </div>
                    <div className="break-all border border-border p-2 bg-background/50">
                      <span className="text-muted-foreground">ROOT:</span>{" "}
                      {result.merkleRoot}
                    </div>
                    <div className="border border-border p-2 bg-background/50 flex items-center justify-between group">
                      <span className="truncate flex-1">
                        <span className="text-muted-foreground">TX:</span>{" "}
                        {result.blockchainTxId}
                      </span>
                      <a
                        href={`https://sepolia.basescan.org/tx/${result.blockchainTxId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-green-500"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm">{result.error}</p>
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
