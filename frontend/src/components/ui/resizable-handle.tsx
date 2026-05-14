import { Separator } from "react-resizable-panels";
import { cn } from "@/lib/utils";

interface CustomResizableHandleProps {
  className?: string;
  withHandle?: boolean;
}

export function CustomResizableHandle({
  className,
  withHandle = false,
}: CustomResizableHandleProps) {
  return (
    <Separator
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1.5 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-dragging:bg-primary/50 transition-colors",
        className,
      )}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
          <div className="h-2.5 w-px bg-muted-foreground/50" />
          <div className="ml-px h-2.5 w-px bg-muted-foreground/50" />
        </div>
      )}
    </Separator>
  );
}
