import { memo, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Database, ChevronLeft, ChevronRight, Plus, Search, Check, X } from "lucide-react";
import { useWorkspaces, useCreateWorkspace, useUpdateWorkspace } from "@/hooks/useWorkspaces";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { WorkspaceItemActions } from "./WorkspaceItemActions";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar = memo(function Sidebar({
  collapsed,
  onToggle,
  isMobile,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: workspaces } = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const updateWorkspace = useUpdateWorkspace();

  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const activeWorkspaceId = location.pathname.match(/\/knowledge-bases\/(\d+)/)?.[1];
  const isHome = location.pathname === "/";

  const filteredWorkspaces = useMemo(() => {
    if (!workspaces) return [];
    if (!searchQuery.trim()) return workspaces;
    return workspaces.filter((ws) => ws.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [workspaces, searchQuery]);

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const handleCreateWorkspace = async () => {
    if (createWorkspace.isPending) return;
    try {
      const newWs = await createWorkspace.mutateAsync({
        name: t("sidebar.newWorkspace"),
      });
      setEditingId(newWs.id);
      setEditName(newWs.name);
      handleNavigate(`/knowledge-bases/${newWs.id}`);
    } catch (error) {
      console.error("Failed to create workspace:", error);
    }
  };

  const handleRename = (id: number, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveRename = async (id: number) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await updateWorkspace.mutateAsync({
        id,
        data: { name: editName.trim() },
      });
      setEditingId(null);
    } catch (error) {
      console.error("Failed to rename workspace:", error);
    }
  };

  const sidebarContent = (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r border-border transition-all duration-200 shrink-0 z-50",
        isMobile
          ? cn(
              "fixed inset-y-0 left-0 w-72 shadow-2xl transform transition-transform duration-300 ease-in-out",
              mobileOpen ? "translate-x-0" : "-translate-x-full",
            )
          : collapsed
            ? "w-14"
            : "w-60",
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-3 h-12 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Database className="w-6 h-6 text-primary shrink-0" />
          {(!collapsed || isMobile) && (
            <span className="font-bold text-primary text-base truncate">PrismRAG</span>
          )}
        </div>
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="shrink-0 px-2 pt-3 space-y-2">
        <Button
          onClick={handleCreateWorkspace}
          disabled={createWorkspace.isPending}
          variant="outline"
          className={cn(
            "w-full justify-start gap-2.5 border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300",
            collapsed && !isMobile ? "px-0 justify-center" : "px-3",
          )}
          title={t("sidebar.newWorkspace")}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {(!collapsed || isMobile) && <span>{t("sidebar.newWorkspace")}</span>}
        </Button>

        <button
          onClick={() => handleNavigate("/")}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors group",
            isHome && !activeWorkspaceId
              ? "bg-primary/10 text-primary font-medium"
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
          )}
          title={collapsed && !isMobile ? t("sidebar.knowledgeBases") : undefined}
        >
          <Database className="w-4 h-4 shrink-0" />
          {(!collapsed || isMobile) && (
            <span className="truncate">{t("sidebar.knowledgeBases")}</span>
          )}
        </button>

        {(!collapsed || isMobile) && (
          <div className="relative px-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("sidebar.searchWorkspaces")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/30 border-none rounded-md py-1.5 pl-8 pr-3 text-xs placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-primary/30 outline-none transition-all"
            />
          </div>
        )}
      </nav>

      {/* Scrollable workspace list */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {(!collapsed || isMobile) && (
          <div className="mt-4 px-2">
            <div className="flex items-center justify-between px-2.5 mb-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t("sidebar.workspaces")}
              </p>
              {filteredWorkspaces.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {filteredWorkspaces.length}
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              {filteredWorkspaces.length === 0 ? (
                <div className="px-2.5 py-4 text-center">
                  <p className="text-xs text-muted-foreground italic">
                    {t("sidebar.noWorkspacesFound")}
                  </p>
                </div>
              ) : (
                filteredWorkspaces.slice(0, 50).map((ws) => {
                  const isActive = activeWorkspaceId === String(ws.id);
                  const isEditing = editingId === ws.id;

                  return (
                    <div
                      key={ws.id}
                      className={cn(
                        "group relative flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer",
                        isActive
                          ? "bg-primary/10 text-primary border-l-2 border-primary font-medium"
                          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                      )}
                      onClick={() => !isEditing && handleNavigate(`/knowledge-bases/${ws.id}`)}
                    >
                      <Database
                        className={cn(
                          "w-3.5 h-3.5 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground/70",
                        )}
                      />

                      {isEditing ? (
                        <div
                          className="flex-1 flex items-center gap-1 min-w-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(ws.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-full bg-background border border-primary/30 rounded px-1 py-0.5 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                          />
                          <button
                            onClick={() => handleSaveRename(ws.id)}
                            className="p-0.5 rounded hover:bg-primary/20 text-primary"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-0.5 rounded hover:bg-muted-foreground/20 text-muted-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="truncate flex-1">{ws.name}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground/60 group-hover:hidden tabular-nums">
                              {ws.document_count}
                            </span>
                            <WorkspaceItemActions
                              workspace={ws}
                              onRename={() => handleRename(ws.id, ws.name)}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Collapsed indicators */}
        {collapsed && !isMobile && (
          <div className="mt-4 px-2 space-y-1">
            {workspaces?.slice(0, 10).map((ws) => {
              const isActive = activeWorkspaceId === String(ws.id);
              return (
                <button
                  key={`ws-${ws.id}`}
                  onClick={() => handleNavigate(`/knowledge-bases/${ws.id}`)}
                  className={cn(
                    "w-full flex items-center justify-center py-1.5 rounded-lg transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50",
                  )}
                  title={ws.name}
                >
                  <Database className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border mt-auto">
        <div className="px-2 py-2 flex items-center justify-between">
          <ThemeToggle />
          {!isMobile && (
            <button
              onClick={onToggle}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              title={collapsed ? t("sidebar.expandSidebar") : t("sidebar.collapseSidebar")}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={onMobileClose}
        />
      )}
      {sidebarContent}
    </>
  );
});
