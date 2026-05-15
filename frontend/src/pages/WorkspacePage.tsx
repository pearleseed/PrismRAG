import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DataPanel } from "@/components/rag/DataPanel";
import { ChatPanel } from "@/components/rag/ChatPanel";
import { VisualPanel } from "@/components/rag/VisualPanel";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useWorkspace, useUpdateWorkspace } from "@/hooks/useWorkspaces";
import { useConversations, useCreateConversation } from "@/hooks/useConversations";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Database, MessageSquare, PieChart } from "lucide-react";
import { Group, Panel } from "react-resizable-panels";
import { CustomResizableHandle } from "@/components/ui/resizable-handle";
import type { Document, RAGStats, DocumentStatus, UpdateWorkspace } from "@/types";

const PROCESSING_STATUSES = new Set<DocumentStatus>(["parsing", "indexing", "processing"]);
const BREAKPOINT = 1200;

type ViewTab = "data" | "chat" | "visual";

export function WorkspacePage() {
  const { t } = useTranslation();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();
  const wsId = workspaceId ? Number(workspaceId) : null;

  const [activeTab, setActiveTab] = useState<ViewTab>("chat");
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      const large = window.innerWidth >= BREAKPOINT;
      setIsLargeScreen(large);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // -- Workspace data --
  const { data: workspace } = useWorkspace(wsId);
  const updateWorkspace = useUpdateWorkspace();

  // -- Conversations --
  const { data: conversations } = useConversations(wsId ?? undefined);
  const createConv = useCreateConversation(wsId ?? undefined);

  // -- Store --
  const { selectedDoc, selectDoc, reset: resetStore } = useWorkspaceStore();

  // Reset store when switching between workspaces
  useEffect(() => {
    resetStore();
  }, [workspaceId, resetStore]);

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------
  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ["documents", workspaceId],
    queryFn: () => api.get<Document[]>(`/documents/workspace/${workspaceId}`),
    enabled: !!workspaceId,
    refetchInterval: (query) => {
      const docs = query.state.data;
      if (docs?.some((d) => PROCESSING_STATUSES.has(d.status))) return 3000;
      return false;
    },
  });

  const { data: ragStats } = useQuery({
    queryKey: ["rag-stats", workspaceId],
    queryFn: () => api.get<RAGStats>(`/rag/stats/${workspaceId}`),
    enabled: !!workspaceId,
  });

  // -----------------------------------------------------------------------
  // Refresh ragStats when processing finishes
  // -----------------------------------------------------------------------
  const processingCount = useMemo(
    () => documents?.filter((d) => PROCESSING_STATUSES.has(d.status)).length ?? 0,
    [documents],
  );

  const prevProcessingRef = useRef(processingCount);
  useEffect(() => {
    if (prevProcessingRef.current > 0 && processingCount === 0) {
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
    }
    prevProcessingRef.current = processingCount;
  }, [processingCount, queryClient, workspaceId]);

  // Keep selectedDoc in sync with latest document data
  useEffect(() => {
    if (selectedDoc && documents) {
      const updated = documents.find((d) => d.id === selectedDoc.id);
      if (updated && updated.status !== selectedDoc.status) {
        selectDoc(updated);
      }
    }
  }, [documents, selectedDoc, selectDoc]);

  const hasIndexedDocs = (ragStats?.indexed_documents ?? 0) > 0;
  const hasDeepragDocs = (ragStats?.prismrag_documents ?? 0) > 0;

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------
  const uploadDoc = useMutation({
    mutationFn: ({
      files,
      customMetadata,
      relativePaths,
    }: {
      files: File[];
      customMetadata?: { key: string; value: string }[];
      relativePaths?: string[];
    }) =>
      api.uploadFiles<Document>(
        `/documents/upload/${workspaceId}`,
        files,
        customMetadata,
        relativePaths,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });

      // Auto-create first conversation if none exist
      if (!conversations || conversations.length === 0) {
        createConv.mutate(t("chat.newChat"));
      }

      toast.success(t("workspace.uploadSuccess"));
    },
    onError: () => toast.error(t("workspace.uploadFailed")),
  });

  const deleteDoc = useMutation({
    mutationFn: (docId: number) => api.delete(`/documents/${docId}`),
    onSuccess: (_, docId) => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      if (selectedDoc?.id === docId) selectDoc(null);
      toast.success(t("workspace.deleteSuccess"));
    },
    onError: () => toast.error(t("workspace.deleteFailed")),
  });

  const processDoc = useMutation({
    mutationFn: (docId: number) => api.post(`/rag/process/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
      toast.info(t("workspace.analyzing"), {
        description: t("workspace.parsing"),
      });
    },
    onError: (error: Error) => {
      if (error.message?.includes("already being analyzed")) {
        toast.info(t("workspace.alreadyAnalyzing"), {
          description: t("workspace.alreadyAnalyzingDesc"),
        });
        queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      } else {
        toast.error(t("workspace.startAnalysisFailed"));
      }
    },
  });

  const reindexDoc = useMutation({
    mutationFn: (docId: number) => api.post(`/rag/reindex/${docId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["rag-stats", workspaceId] });
      toast.success(t("workspace.reprocessingStarted"));
    },
    onError: () => toast.error(t("workspace.reprocessingFailed")),
  });

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------
  const handleSelectDoc = useCallback(
    (doc: Document) => {
      if (doc.status !== "indexed") return;
      if (selectedDoc?.id === doc.id) {
        selectDoc(null);
      } else {
        selectDoc(doc);
        if (!isLargeScreen) setActiveTab("visual");
      }
    },
    [selectedDoc, selectDoc, isLargeScreen],
  );

  const handleUpdateWorkspace = useCallback(
    async (data: UpdateWorkspace) => {
      if (!wsId) return;
      await updateWorkspace.mutateAsync({ id: wsId, data });
    },
    [wsId, updateWorkspace],
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const commonProps = {
    workspace,
    documents,
    docsLoading,
    ragStats,
    selectedDocId: selectedDoc?.id ?? null,
    onSelectDoc: handleSelectDoc,
    onUpload: (
      files: File[],
      customMetadata?: { key: string; value: string }[],
      relativePaths?: string[],
    ) => uploadDoc.mutate({ files, customMetadata, relativePaths }),
    isUploading: uploadDoc.isPending,
    onDelete: (id: number) => deleteDoc.mutate(id),
    onProcess: (id: number) => processDoc.mutate(id),
    onReindex: (id: number) => reindexDoc.mutate(id),
    isProcessing: processDoc.isPending,
    onUpdateWorkspace: handleUpdateWorkspace,
  };

  if (isLargeScreen) {
    return (
      <div className="h-full overflow-hidden">
        <Group id="workspace-layout" orientation="horizontal" className="h-full">
          <Panel id="data-panel" defaultSize="22%" minSize="22%" maxSize="40%" collapsible={true}>
            <DataPanel {...commonProps} isMobile={false} />
          </Panel>

          <CustomResizableHandle />

          <Panel id="chat-panel" defaultSize="40%" minSize="30%">
            <ChatPanel
              workspaceId={workspaceId || ""}
              hasIndexedDocs={hasIndexedDocs}
              workspace={workspace ?? null}
            />
          </Panel>

          <CustomResizableHandle />

          <Panel id="visual-panel" defaultSize="30%" minSize="20%">
            <VisualPanel workspaceId={workspaceId || ""} hasDeepragDocs={hasDeepragDocs} />
          </Panel>
        </Group>
      </div>
    );
  }

  // Tabbed Mobile/Tablet Layout
  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Mobile Tab Header */}
      <div className="flex border-b border-border bg-card shrink-0 px-2 h-10">
        <button
          onClick={() => setActiveTab("data")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 text-xs font-medium transition-colors border-b-2",
            activeTab === "data"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground",
          )}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{t("workspace.data")}</span>
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 text-xs font-medium transition-colors border-b-2",
            activeTab === "chat"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground",
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{t("workspace.chat")}</span>
        </button>
        <button
          onClick={() => setActiveTab("visual")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 text-xs font-medium transition-colors border-b-2",
            activeTab === "visual"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground",
          )}
        >
          <PieChart className="w-3.5 h-3.5" />
          <span>{t("workspace.visual")}</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        <div className={cn("h-full", activeTab !== "data" && "hidden")}>
          <DataPanel {...commonProps} isMobile={true} />
        </div>
        <div className={cn("h-full", activeTab !== "chat" && "hidden")}>
          <ChatPanel
            workspaceId={workspaceId || ""}
            hasIndexedDocs={hasIndexedDocs}
            workspace={workspace ?? null}
          />
        </div>
        <div className={cn("h-full", activeTab !== "visual" && "hidden")}>
          <VisualPanel workspaceId={workspaceId || ""} hasDeepragDocs={hasDeepragDocs} />
        </div>
      </div>
    </div>
  );
}
