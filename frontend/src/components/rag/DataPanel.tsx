import { useState, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  FileText,
  Pencil,
  Check,
  X,
  Loader2,
  Sparkles,
  Settings2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UploadZone } from "./UploadZone";
import { StatsBar } from "./StatsBar";
import { DocumentFilters, type FilterStatus } from "./DocumentFilters";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WorkspaceSettings } from "./WorkspaceSettings";
import { CustomMetadataInput } from "./CustomMetadataInput";
import { DocumentCard } from "./DocumentCard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Document, RAGStats, DocumentStatus, KnowledgeBase, UpdateWorkspace } from "@/types";

const PROCESSING_STATUSES = new Set<DocumentStatus>(["parsing", "indexing", "processing"]);
const PROCESSABLE_STATUSES = new Set<DocumentStatus>(["pending", "failed"]);

interface DataPanelProps {
  workspace: KnowledgeBase | undefined;
  documents: Document[] | undefined;
  docsLoading: boolean;
  ragStats: RAGStats | undefined;
  selectedDocId: number | null;
  onSelectDoc: (doc: Document) => void;
  onUpload: (
    files: File[],
    customMetadata?: { key: string; value: string }[],
    paths?: string[],
  ) => void;
  isUploading: boolean;
  onDelete: (id: number) => void;
  onProcess: (id: number) => void;
  onReindex: (id: number) => void;
  isProcessing: boolean;
  onUpdateWorkspace: (data: UpdateWorkspace) => Promise<void>;
  isMobile?: boolean;
}

export const DataPanel = memo(function DataPanel({
  workspace,
  documents,
  docsLoading,
  ragStats,
  selectedDocId,
  onSelectDoc,
  onUpload,
  isUploading,
  onDelete,
  onProcess,
  onReindex,
  isProcessing,
  onUpdateWorkspace,
  isMobile,
}: DataPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [deleteDocConfirm, setDeleteDocConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customMetadata, setCustomMetadata] = useState<{ key: string; value: string }[]>([]);
  const [uploadSectionOpen, setUploadSectionOpen] = useState(true);

  const handleUpload = useCallback(
    (files: File[], paths?: string[]) => {
      const validMeta = customMetadata.filter((m) => m.key.trim() !== "");
      onUpload(files, validMeta.length > 0 ? validMeta : undefined, paths);
      // Optional: clear metadata after successful upload? Leaving it for convenience if they upload multiple.
    },
    [customMetadata, onUpload],
  );

  const processingCount = useMemo(
    () => documents?.filter((d) => PROCESSING_STATUSES.has(d.status)).length ?? 0,
    [documents],
  );

  const pendingCount = useMemo(
    () => documents?.filter((d) => PROCESSABLE_STATUSES.has(d.status)).length ?? 0,
    [documents],
  );

  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    let result = documents;
    if (statusFilter !== "all") {
      if (statusFilter === "parsing") {
        result = result.filter((d) => PROCESSING_STATUSES.has(d.status));
      } else {
        result = result.filter((d) => d.status === statusFilter);
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((d) => d.original_filename.toLowerCase().includes(q));
    }
    return result;
  }, [documents, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    documents?.forEach((d) => {
      counts.all = (counts.all || 0) + 1;
      counts[d.status] = (counts[d.status] || 0) + 1;
    });
    return counts as Record<FilterStatus, number>;
  }, [documents]);

  const handleBatchProcess = useCallback(async () => {
    if (!documents || batchProcessing) return;
    const processable = documents.filter((d) => PROCESSABLE_STATUSES.has(d.status));
    if (processable.length === 0) return;

    setBatchProcessing(true);
    toast.info(t("workspace.analyzing"), {
      description: t("workspace.batchAnalysisDesc"),
    });

    try {
      await api.post("/rag/process-batch", {
        document_ids: processable.map((d) => d.id),
      });
    } catch {
      toast.error(t("workspace.batchAnalysisFailed"));
    } finally {
      setBatchProcessing(false);
    }
  }, [documents, batchProcessing, t]);

  const handleStartEdit = () => {
    if (workspace) {
      setEditName(workspace.name);
      setEditDesc(workspace.description || "");
      setIsEditingName(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    await onUpdateWorkspace({
      name: editName.trim(),
      description: editDesc.trim() || undefined,
    });
    setIsEditingName(false);
  };

  return (
    <div className={cn("h-full flex flex-col overflow-hidden", !isMobile && "border-r")}>
      {/* Header — workspace name */}
      <div className="shrink-0 px-3 pt-3 pb-2 border-b space-y-1.5">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-3 h-3" />
          <span className="hidden sm:inline">{t("common.dashboard")}</span>
          <span className="sm:hidden">{t("common.back")}</span>
        </button>

        {isEditingName ? (
          <div className="space-y-1.5">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
              placeholder={t("common.name")}
              autoFocus
              className="text-sm font-semibold h-8"
            />
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              placeholder={t("common.description")}
              className="text-xs h-7"
            />
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editName.trim()}
                className="h-6 text-[10px] px-2"
              >
                <Check className="w-3 h-3 mr-0.5" /> {t("common.save")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditingName(false)}
                className="h-6 text-[10px] px-2"
              >
                <X className="w-3 h-3 mr-0.5" /> {t("common.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold truncate">
                {workspace?.name || t("workspace.knowledgeBase")}
              </h1>
              {workspace?.description && (
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  {workspace.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setSettingsOpen(true)}
                className="h-7 w-7"
                title={t("workspace.workspaceSettings")}
              >
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleStartEdit}
                className="h-7 w-7"
                title={t("workspace.editWorkspace")}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Upload zone header & settings */}
      <div className="shrink-0 flex flex-col border-t border-b">
        <div
          role="button"
          tabIndex={0}
          onClick={() => setUploadSectionOpen(!uploadSectionOpen)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setUploadSectionOpen(!uploadSectionOpen);
            }
          }}
          className="px-3 py-1.5 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-1.5">
            {uploadSectionOpen ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
            <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              {t("workspace.addDocuments")}
            </h3>
          </div>
          {uploadSectionOpen && (
            <div onClick={(e) => e.stopPropagation()}>
              <CustomMetadataInput metadata={customMetadata} onChange={setCustomMetadata} />
            </div>
          )}
        </div>

        <AnimatePresence initial={false}>
          {uploadSectionOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-3 pb-3">
                <div className="aspect-16/6 min-h-[80px]">
                  <UploadZone onUpload={handleUpload} isUploading={isUploading} mini />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Stats bar */}
      <div className="shrink-0 px-3 py-1.5 border-b space-y-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            {t("workspace.documents")}
          </h2>
          <span className="text-[10px] text-muted-foreground">
            {documents?.length ?? 0} file{(documents?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        </div>
        <StatsBar stats={ragStats} processingCount={processingCount} />

        {/* Analyze All banner — compact for narrow panel */}
        {pendingCount > 0 && (
          <button
            onClick={handleBatchProcess}
            disabled={batchProcessing || processingCount > 0}
            className={cn(
              "w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-md",
              "border border-blue-400/20 bg-blue-400/6",
              "hover:bg-blue-400/10 transition-colors",
              (batchProcessing || processingCount > 0) && "opacity-50 pointer-events-none",
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles
                className={cn("w-3 h-3 text-blue-400 shrink-0", batchProcessing && "animate-spin")}
              />
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-tight truncate">
                {batchProcessing ? t("workspace.analyzingAll") : t("workspace.analyzeAll")}
              </span>
            </div>
            <span className="text-[9px] text-muted-foreground/80 shrink-0 bg-blue-400/10 px-1 rounded">
              {pendingCount}
            </span>
          </button>
        )}
      </div>

      {/* Document list — ~80% */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {docsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
            <span className="text-xs text-muted-foreground">{t("common.loading")}</span>
          </div>
        ) : !documents || documents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-3">
            <p className="text-xs text-muted-foreground text-center">
              {t("workspace.noDocuments")}
            </p>
          </div>
        ) : (
          <>
            <div className="px-3 pt-2 shrink-0">
              <DocumentFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                counts={statusCounts}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
              <AnimatePresence mode="popLayout">
                {filteredDocs.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    doc={doc}
                    selected={doc.id === selectedDocId}
                    onDelete={setDeleteDocConfirm}
                    onReindex={onReindex}
                    onProcess={onProcess}
                    isProcessing={isProcessing}
                    onClick={onSelectDoc}
                  />
                ))}
              </AnimatePresence>
              {filteredDocs.length === 0 && documents.length > 0 && (
                <div className="text-center py-4 text-[11px] text-muted-foreground">
                  {t("workspace.noDocumentsFilter")}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Workspace settings overlay */}
      {workspace && (
        <WorkspaceSettings
          workspace={workspace}
          onSave={onUpdateWorkspace}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteDocConfirm !== null}
        onConfirm={async () => {
          if (deleteDocConfirm !== null) {
            onDelete(deleteDocConfirm);
            setDeleteDocConfirm(null);
          }
        }}
        onCancel={() => setDeleteDocConfirm(null)}
        title={t("workspace.deleteDocument")}
        message={t("workspace.deleteDocumentConfirm")}
        confirmLabel={t("common.delete")}
        variant="danger"
      />
    </div>
  );
});
