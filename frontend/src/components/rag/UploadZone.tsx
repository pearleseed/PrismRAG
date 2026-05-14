import { useState, useRef, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Upload, FileUp, FolderUp } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES =
  ".pdf,.txt,.docx,.md,.pptx,.html,.htm,.xlsx,.epub,.csv,.xml,.nxml,.tex,.png,.jpg,.jpeg,.tiff,.bmp,.wav,.mp3,.m4a,.aac,.ogg,.flac,.mp4,.avi,.mov,.webm,.mkv,.adoc,.asciidoc,.xbrl,.json,.vtt";
const ACCEPTED_EXTENSIONS = new Set([
  "pdf",
  "txt",
  "docx",
  "md",
  "pptx",
  "html",
  "htm",
  "xlsx",
  "epub",
  "csv",
  "xml",
  "nxml",
  "tex",
  "png",
  "jpg",
  "jpeg",
  "tiff",
  "bmp",
  "wav",
  "mp3",
  "m4a",
  "aac",
  "ogg",
  "flac",
  "mp4",
  "avi",
  "mov",
  "webm",
  "mkv",
  "adoc",
  "asciidoc",
  "xbrl",
  "json",
  "vtt",
]);
const MAX_SIZE_MB = 50;

interface UploadZoneProps {
  onUpload: (files: File[], paths?: string[]) => void;
  isUploading?: boolean;
  compact?: boolean;
  /** Always-visible mini drag-drop zone */
  mini?: boolean;
}

export const UploadZone = memo(function UploadZone({
  onUpload,
  isUploading,
  compact,
  mini,
}: UploadZoneProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED_EXTENSIONS.has(ext))
        return t("workspace.unsupportedFormat", { ext: `.${ext}` });
      if (file.size > MAX_SIZE_MB * 1024 * 1024)
        return t("workspace.fileTooLarge", { max: MAX_SIZE_MB });
      return null;
    },
    [t],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      const validFiles: File[] = [];
      const paths: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const error = validateFile(file);
        if (error) continue;

        validFiles.push(file);
        const relPath = (file as { webkitRelativePath?: string }).webkitRelativePath;
        paths.push(relPath || "");
      }

      if (validFiles.length > 0) {
        const hasPaths = paths.some((p) => p !== "");
        onUpload(validFiles, hasPaths ? paths : undefined);
      }
    },
    [onUpload, validateFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const triggerFileUpload = () => fileInputRef.current?.click();
  const triggerFolderUpload = (e: React.MouseEvent) => {
    e.stopPropagation();
    folderInputRef.current?.click();
  };

  const hiddenInputs = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        onChange={(e) => {
          handleFiles(e.target.files);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        className="hidden"
      />
      <input
        ref={folderInputRef}
        type="file"
        {...({
          webkitdirectory: "",
          directory: "",
        } as unknown as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(e) => {
          handleFiles(e.target.files);
          if (folderInputRef.current) folderInputRef.current.value = "";
        }}
        className="hidden"
      />
    </>
  );

  if (mini) {
    return (
      <>
        {hiddenInputs}
        <motion.div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={triggerFileUpload}
          animate={isDragOver ? { scale: 1.01 } : { scale: 1 }}
          className={cn(
            "h-full rounded-lg border-2 border-dashed cursor-pointer transition-colors duration-200",
            "flex flex-col items-center justify-center relative group",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30",
            isUploading && "opacity-60 pointer-events-none",
          )}
        >
          <AnimatePresence mode="wait">
            {isDragOver ? (
              <motion.div
                key="drop"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center"
              >
                <FileUp className="w-6 h-6 text-primary mb-1" />
                <p className="text-xs font-medium text-primary">{t("workspace.dropFiles")}</p>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center"
              >
                <Upload
                  className={cn(
                    "w-6 h-6 text-muted-foreground mb-1",
                    isUploading && "animate-pulse",
                  )}
                />
                <p className="text-xs font-medium text-center px-2">
                  {isUploading ? t("common.uploading") : t("workspace.dropOrClick")}
                </p>
                {!isUploading && (
                  <button
                    onClick={triggerFolderUpload}
                    className="mt-1 text-[10px] text-primary hover:underline flex items-center gap-1"
                  >
                    <FolderUp className="w-3 h-3" />
                    {t("workspace.uploadFolder")}
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {hiddenInputs}
        <button
          type="button"
          onClick={triggerFileUpload}
          disabled={isUploading}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "disabled:opacity-50 disabled:pointer-events-none transition-colors",
          )}
        >
          <Upload className={cn("w-4 h-4", isUploading && "animate-pulse")} />
          {isUploading ? t("common.uploading") : t("common.upload")}
        </button>
        <button
          type="button"
          onClick={triggerFolderUpload}
          disabled={isUploading}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium",
            "bg-muted text-muted-foreground hover:bg-muted/80",
            "disabled:opacity-50 disabled:pointer-events-none transition-colors border",
          )}
        >
          <FolderUp className="w-4 h-4" />
          {t("workspace.folder")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full">
      {hiddenInputs}
      <motion.div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={triggerFileUpload}
        animate={isDragOver ? { scale: 1.01 } : { scale: 1 }}
        className={cn(
          "relative w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors duration-200",
          "flex flex-col items-center justify-center py-8 px-4",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          isUploading && "opacity-60 pointer-events-none",
        )}
      >
        <AnimatePresence mode="wait">
          {isDragOver ? (
            <motion.div
              key="drop"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center"
            >
              <FileUp className="w-8 h-8 text-primary mb-2" />
              <p className="text-sm font-medium text-primary">{t("workspace.dropFiles")}</p>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <Upload className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                {isUploading ? t("common.uploading") : t("workspace.dropOrClick")}
              </p>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-xs text-muted-foreground">
                  {t("workspace.supportedFormats", { max: MAX_SIZE_MB })}
                </p>
                {!isUploading && (
                  <button
                    onClick={triggerFolderUpload}
                    className="text-xs text-primary font-medium hover:underline flex items-center gap-1.5"
                  >
                    <FolderUp className="w-4 h-4" />
                    {t("workspace.uploadFolder")}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
});
