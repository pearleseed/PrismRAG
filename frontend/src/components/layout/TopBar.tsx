import { memo, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ChevronRight, Cpu, Database, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface ConfigStatus {
  llm_provider: string;
  llm_model: string;
  kg_embedding_provider: string;
  kg_embedding_model: string;
  kg_embedding_dimension: number;
  prismrag_embedding_model: string;
  prismrag_reranker_model: string;
}

interface TopBarProps {
  actions?: React.ReactNode;
  className?: string;
  onMenuClick?: () => void;
  isMobile?: boolean;
}

export const TopBar = memo(function TopBar({
  actions,
  className,
  onMenuClick,
  isMobile,
}: TopBarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const [config, setConfig] = useState<ConfigStatus | null>(null);

  useEffect(() => {
    api
      .get<ConfigStatus>("/config/status")
      .then(setConfig)
      .catch(() => {});
  }, []);

  const segments: { label: string; active: boolean }[] = [{ label: "PrismRAG", active: false }];

  if (location.pathname === "/") {
    segments.push({ label: t("topbar.knowledgeBases"), active: true });
  } else if (location.pathname.startsWith("/knowledge-bases/")) {
    segments.push({ label: t("topbar.workspace"), active: true });
  }

  return (
    <div
      className={cn(
        "h-12 flex items-center justify-between px-4 border-b border-border shrink-0 bg-background/80 backdrop-blur-md z-30 sticky top-0",
        className,
      )}
    >
      {/* Left-side: Menu + Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        {isMobile && (
          <button
            onClick={onMenuClick}
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="flex items-center gap-1.5 text-sm min-w-0">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
              <span
                className={cn(
                  "truncate",
                  seg.active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {seg.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right-side: model badges + actions */}
      <div className="flex items-center gap-2 shrink-0">
        {config && !isMobile && (
          <div className="hidden sm:flex items-center gap-1.5">
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                config.llm_provider === "ollama"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400",
              )}
              title={`LLM: ${config.llm_provider} / ${config.llm_model}`}
            >
              <Cpu className="w-3 h-3" />
              <span className="hidden md:inline">{config.llm_model}</span>
            </div>
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400"
              title={`KG Embedding: ${config.kg_embedding_provider} / ${config.kg_embedding_model} (${config.kg_embedding_dimension}d)`}
            >
              <Database className="w-3 h-3" />
              <span className="hidden md:inline">{config.kg_embedding_model}</span>
            </div>
          </div>
        )}
        <LanguageSwitcher />
        {actions}
      </div>
    </div>
  );
});
