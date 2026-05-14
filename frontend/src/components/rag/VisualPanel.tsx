import { memo } from "react";
import { BookOpen, Network, List, FileSearch, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Panel, Group, Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useResizeObserver } from "@/hooks/useResizeObserver";
import { DocumentViewer } from "./DocumentViewer";
import { KnowledgeGraphView } from "./KnowledgeGraphView";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { EntityList } from "./EntityList";

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------
function TabButton({
  active,
  icon,
  label,
  onClick,
  showLabel,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  showLabel?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={!showLabel ? label : undefined}
      className={cn(
        "group relative flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200",
        active
          ? "bg-primary/10 text-primary shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/80",
        !showLabel && "px-2 justify-center",
      )}
    >
      <span
        className={cn(
          "transition-transform duration-200",
          active ? "scale-110" : "group-hover:scale-105",
        )}
      >
        {icon}
      </span>
      {showLabel && <span className="truncate max-w-[120px]">{label}</span>}
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 border border-primary/20 rounded-md pointer-events-none"
          initial={false}
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Sub-tab button (Segmented control style)
// ---------------------------------------------------------------------------
function SubTabButton({
  active,
  icon,
  label,
  onClick,
  showLabel,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  showLabel?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={!showLabel ? label : undefined}
      className={cn(
        "relative flex items-center justify-center gap-1.5 flex-1 py-1 text-[11px] font-semibold transition-all duration-200 rounded",
        active ? "text-primary z-10" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className={active ? "scale-110" : ""}>{icon}</span>
      {showLabel && <span className="truncate">{label}</span>}
      {active && (
        <motion.div
          layoutId="activeSubTab"
          className="absolute inset-0 bg-background shadow-sm rounded border border-border/50"
          initial={false}
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyVisual() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col items-center justify-center px-4 py-8 overflow-y-auto custom-scrollbar"
    >
      <div className="relative mb-4 sm:mb-6 shrink-0">
        <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl animate-pulse" />
        <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-muted/50 border border-border/50 flex items-center justify-center shadow-inner">
          <FileSearch className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground/40" />
        </div>
      </div>
      <p className="text-sm font-semibold text-foreground tracking-tight text-center">
        Select a document to view
      </p>
      <p className="text-xs text-muted-foreground/60 mt-2 text-center max-w-[220px] leading-relaxed">
        Click on an indexed document in the data panel to explore its content and connections.
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// KG Content — Graph + Analytics split or Entities full
// ---------------------------------------------------------------------------
const KGContent = memo(function KGContent({
  workspaceId,
  highlightEntities,
}: {
  workspaceId: string;
  highlightEntities: string[];
}) {
  const { kgSubTab, setKgSubTab } = useWorkspaceStore();
  const [ref, { width, height }] = useResizeObserver<HTMLDivElement>();
  const showLabels = width > 350;
  const isCrampedHeight = height < 500;

  return (
    <div ref={ref} className="h-full flex flex-col min-h-0 bg-background/30">
      {/* Sub-tab bar — Segmented style */}
      <div className="shrink-0 p-1 bg-muted/40 border-b">
        <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border/50">
          <SubTabButton
            active={kgSubTab === "graph"}
            icon={<Network className="w-3 h-3" />}
            label="Graph & Analytics"
            onClick={() => setKgSubTab("graph")}
            showLabel={showLabels}
          />
          <SubTabButton
            active={kgSubTab === "entities"}
            icon={<List className="w-3 h-3" />}
            label="Entity Directory"
            onClick={() => setKgSubTab("entities")}
            showLabel={showLabels}
          />
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {kgSubTab === "graph" ? (
            <motion.div
              key="kg-graph"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <Group orientation={width > 600 && height < 400 ? "horizontal" : "vertical"}>
                {/* Graph Area */}
                <Panel defaultSize={isCrampedHeight ? 70 : 60} minSize={30}>
                  <div className="h-full relative overflow-hidden border-b border-border/50">
                    <KnowledgeGraphView
                      projectId={workspaceId}
                      highlightEntities={highlightEntities}
                    />
                  </div>
                </Panel>

                {/* Resize Handle */}
                <Separator
                  className={cn(
                    "flex items-center justify-center hover:bg-primary/20 transition-colors group bg-transparent",
                    width > 600 && height < 400 ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-full bg-border group-hover:bg-primary/40 transition-colors",
                      width > 600 && height < 400 ? "w-1 h-8" : "w-8 h-1",
                    )}
                  />
                </Separator>

                {/* Analytics Area */}
                <Panel defaultSize={isCrampedHeight ? 30 : 40} minSize={20}>
                  <div className="h-full overflow-y-auto p-4 custom-scrollbar">
                    <AnalyticsDashboard projectId={workspaceId} compact />
                  </div>
                </Panel>
              </Group>
            </motion.div>
          ) : (
            <motion.div
              key="kg-entities"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 overflow-y-auto p-4 custom-scrollbar"
            >
              <EntityList projectId={workspaceId} highlightEntities={highlightEntities} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// VisualPanel — main export
// ---------------------------------------------------------------------------
interface VisualPanelProps {
  workspaceId: string;
  hasDeepragDocs: boolean;
}

export const VisualPanel = memo(function VisualPanel({
  workspaceId,
  hasDeepragDocs,
}: VisualPanelProps) {
  const {
    selectedDoc,
    activeTab,
    setActiveTab,
    scrollToPage,
    scrollToHeading,
    scrollToImageSrc,
    highlightChunks,
    highlightEntities,
    clearScrollTarget,
    clearHighlights,
  } = useWorkspaceStore();

  const [containerRef, { width }] = useResizeObserver<HTMLDivElement>();
  const showLabels = width > 380;
  const showHighlightsText = width > 450;

  if (!selectedDoc) return <EmptyVisual />;

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden min-h-0 bg-background">
      {/* Tab bar */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-2 border-b bg-card/30">
        <TabButton
          active={activeTab === "content"}
          icon={<BookOpen className="w-3.5 h-3.5" />}
          label="Document Content"
          onClick={() => setActiveTab("content")}
          showLabel={showLabels}
        />
        {hasDeepragDocs && (
          <TabButton
            active={activeTab === "kg"}
            icon={<Network className="w-3.5 h-3.5" />}
            label="Knowledge Graph"
            onClick={() => setActiveTab("kg")}
            showLabel={showLabels}
          />
        )}

        {/* Active highlights indicator */}
        <AnimatePresence>
          {highlightChunks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.9 }}
              className={cn(
                "ml-auto flex items-center gap-1.5 pl-3 border-l",
                !showHighlightsText && "pl-1.5",
              )}
            >
              <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                <span className="text-[10px] font-bold">
                  {highlightChunks.length}{" "}
                  {showHighlightsText &&
                    (highlightChunks.length === 1 ? "highlight" : "highlights")}
                </span>
                <button
                  onClick={clearHighlights}
                  className="hover:bg-primary/20 rounded-full transition-colors p-0.5"
                  title="Clear highlights"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeTab === "content" ? (
            <motion.div
              key="content-viewer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <DocumentViewer
                doc={selectedDoc}
                scrollToPage={scrollToPage}
                scrollToHeading={scrollToHeading}
                scrollToImageSrc={scrollToImageSrc}
                highlightChunks={highlightChunks}
                onScrolled={clearScrollTarget}
              />
            </motion.div>
          ) : (
            <motion.div
              key="kg-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <KGContent workspaceId={workspaceId} highlightEntities={highlightEntities} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
