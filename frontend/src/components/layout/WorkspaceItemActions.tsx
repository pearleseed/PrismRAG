import { memo, useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Archive, Share } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteWorkspace } from "@/hooks/useWorkspaces";
import { cn } from "@/lib/utils";

interface WorkspaceItemActionsProps {
  workspace: {
    id: number;
    name: string;
  };
  onRename?: () => void;
}

export const WorkspaceItemActions = memo(function WorkspaceItemActions({
  workspace,
  onRename,
}: WorkspaceItemActionsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteWorkspace = useDeleteWorkspace();

  const handleDelete = () => {
    deleteWorkspace.mutate(workspace.id);
    setShowDeleteConfirm(false);
    setIsMenuOpen(false);
  };

  return (
    <>
      <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen(true);
            }}
            className={cn(
              "p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted-foreground/10 transition-all",
              isMenuOpen && "opacity-100 bg-muted-foreground/10",
            )}
          >
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-1" align="end" side="right">
          <div className="flex flex-col">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                onRename?.();
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted text-foreground transition-colors text-left"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Rename</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                // Placeholder for share
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted text-foreground transition-colors text-left"
            >
              <Share className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(false);
                // Placeholder for archive
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted text-foreground transition-colors text-left"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive</span>
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
                setIsMenuOpen(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-destructive/10 text-destructive transition-colors text-left"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Workspace"
        message={`Are you sure you want to delete "${workspace.name}"? This action cannot be undone and all documents within it will be removed.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
});
