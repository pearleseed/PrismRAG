import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useWorkspaces, useCreateWorkspace, useDeleteWorkspace } from "@/hooks/useWorkspaces";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Database, FileText, Trash2, MoreHorizontal, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { KnowledgeBase } from "@/types";

export function KnowledgeBasesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: workspaces, isLoading } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();
  const [showNewWorkspace, setShowNewWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  // Close menu on outside click
  useEffect(() => {
    if (openMenu === null) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim() || createWorkspace.isPending) return;
    try {
      const ws = await createWorkspace.mutateAsync({ name: newWorkspaceName });
      toast.success(t("kb.kbCreated"));
      setNewWorkspaceName("");
      setShowNewWorkspace(false);
      navigate(`/knowledge-bases/${ws.id}`);
    } catch {
      toast.error("Failed to create knowledge base");
    }
  };

  const handleDeleteWorkspace = async (id: number) => {
    try {
      await deleteWorkspace.mutateAsync(id);
      toast.success(t("kb.kbDeleted"));
    } catch {
      toast.error(t("kb.kbDeleteFailed"));
    }
    setDeleteConfirm(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return t("common.today");
    if (days === 1) return t("common.yesterday");
    if (days < 7) return t("common.daysAgo", { days });
    return date.toLocaleDateString(t("common.locale"), { month: "short", day: "numeric" });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Section header + action */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">{t("kb.knowledgeBases")}</h2>
            {workspaces && workspaces.length > 0 && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {workspaces.length} {t("kb.knowledgeBaseCount")}
              </p>
            )}
          </div>
          <Button onClick={() => setShowNewWorkspace(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {t("kb.newKnowledgeBase")}
          </Button>
        </div>

        {/* New Workspace Modal */}
        {showNewWorkspace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="w-full max-w-md mx-4 shadow-2xl">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{t("kb.newKnowledgeBase")}</h3>
                  <button
                    onClick={() => setShowNewWorkspace(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <Input
                  placeholder={t("kb.kbNamePlaceholder")}
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateWorkspace();
                    }
                  }}
                  autoFocus
                />
                <div className="flex justify-end gap-2 mt-4">
                  <Button variant="ghost" onClick={() => setShowNewWorkspace(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={handleCreateWorkspace}
                    disabled={createWorkspace.isPending || !newWorkspaceName.trim()}
                  >
                    {createWorkspace.isPending ? t("common.creating") : t("common.create")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-5 pb-4">
                  <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !workspaces || workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6">
              <Database className="w-10 h-10 text-blue-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">{t("kb.emptyTitle")}</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">{t("kb.emptyDesc")}</p>
            <Button onClick={() => setShowNewWorkspace(true)} size="lg">
              <Plus className="w-4 h-4 mr-2" />
              {t("kb.newKnowledgeBase")}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws: KnowledgeBase) => (
              <Card
                key={ws.id}
                className="group cursor-pointer transition-all hover:ring-1 hover:ring-primary/20 hover:-translate-y-0.5 hover:shadow-lg"
                onClick={() => navigate(`/knowledge-bases/${ws.id}`)}
              >
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Database className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm truncate">{ws.name}</h3>
                        {ws.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {ws.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenu(openMenu === ws.id ? null : ws.id);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      {openMenu === ws.id && (
                        <div className="absolute right-0 top-8 z-20 bg-card border rounded-lg shadow-lg py-1 w-32">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm(ws.id);
                              setOpenMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-destructive hover:bg-muted transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t("common.delete")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {ws.document_count} {t("workspace.documents").toLowerCase()}
                    </span>
                    <span className="flex items-center gap-1 text-green-500">
                      {ws.indexed_count} {t("workspace.status.indexed").toLowerCase()}
                    </span>
                    {ws.updated_at && (
                      <>
                        <span className="text-border">|</span>
                        <span>{formatDate(ws.updated_at)}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        onConfirm={() => deleteConfirm !== null && handleDeleteWorkspace(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
        title={t("kb.deleteKB")}
        message={t("kb.deleteKBConfirm")}
        confirmLabel={t("common.delete")}
        variant="danger"
      />
    </div>
  );
}
