import { memo } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DocumentStatus } from "@/types";

type FilterStatus = "all" | DocumentStatus;

const TABS: { value: FilterStatus; labelKey: string }[] = [
  { value: "all", labelKey: "common.all" },
  { value: "indexed", labelKey: "workspace.status.indexed" },
  { value: "parsing", labelKey: "workspace.status.processing" },
  { value: "failed", labelKey: "workspace.status.failed" },
];

interface DocumentFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: FilterStatus;
  onStatusChange: (s: FilterStatus) => void;
  counts: Record<FilterStatus, number>;
}

export type { FilterStatus };

export const DocumentFilters = memo(function DocumentFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  counts,
}: DocumentFiltersProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 flex-wrap @container">
      {/* Search */}
      <div className="relative flex-1 min-w-[140px] max-w-full">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder={t("common.filter")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-7 h-7 text-[11px]"
        />
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
        {TABS.map((tab) => {
          const isActive = statusFilter === tab.value;
          let count = counts[tab.value] ?? 0;
          if (tab.value === "parsing") {
            count = (counts.parsing ?? 0) + (counts.indexing ?? 0) + (counts.processing ?? 0);
          }
          return (
            <button
              key={tab.value}
              onClick={() => onStatusChange(tab.value)}
              className={cn(
                "px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap flex items-center",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="hidden @[350px]:inline">{t(tab.labelKey)}</span>
              <span className="@[350px]:hidden">
                {t(tab.labelKey).length > 6
                  ? t(tab.labelKey).substring(0, 4) + "."
                  : t(tab.labelKey)}
              </span>
              {count > 0 && (
                <span
                  className={cn(
                    "ml-1 text-[9px]",
                    isActive ? "text-primary" : "text-muted-foreground/60",
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
