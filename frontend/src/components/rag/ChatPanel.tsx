import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
  createContext,
  useContext,
  Children,
  isValidElement,
  createElement,
  type ComponentPropsWithoutRef,
  type JSX,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import type { ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Send,
  Square,
  Bot,
  User,
  Loader2,
  Trash2,
  FileText,
  Save,
  ImageIcon,
  Brain,
  ChevronDown,
  Settings,
  RotateCcw,
  Copy,
  ClipboardCheck,
  FileCode,
  ThumbsUp,
  ThumbsDown,
  DatabaseZap,
  ShieldCheck,
  Languages,
  Hash,
  Layout,
  Ban,
} from "lucide-react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import javascript from "react-syntax-highlighter/dist/esm/languages/prism/javascript";
import typescript from "react-syntax-highlighter/dist/esm/languages/prism/typescript";
import bash from "react-syntax-highlighter/dist/esm/languages/prism/bash";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import sql from "react-syntax-highlighter/dist/esm/languages/prism/sql";
import css from "react-syntax-highlighter/dist/esm/languages/prism/css";
import markup from "react-syntax-highlighter/dist/esm/languages/prism/markup";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import java from "react-syntax-highlighter/dist/esm/languages/prism/java";
import go from "react-syntax-highlighter/dist/esm/languages/prism/go";
import cpp from "react-syntax-highlighter/dist/esm/languages/prism/cpp";
import diff from "react-syntax-highlighter/dist/esm/languages/prism/diff";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import { toast } from "sonner";
import { cn, generateId } from "@/lib/utils";
import { api } from "@/lib/api";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useThemeStore } from "@/stores/useThemeStore";

SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("javascript", javascript);
SyntaxHighlighter.registerLanguage("js", javascript);
SyntaxHighlighter.registerLanguage("typescript", typescript);
SyntaxHighlighter.registerLanguage("ts", typescript);
SyntaxHighlighter.registerLanguage("bash", bash);
SyntaxHighlighter.registerLanguage("sh", bash);
SyntaxHighlighter.registerLanguage("shell", bash);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("sql", sql);
SyntaxHighlighter.registerLanguage("css", css);
SyntaxHighlighter.registerLanguage("html", markup);
SyntaxHighlighter.registerLanguage("xml", markup);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("yml", yaml);
SyntaxHighlighter.registerLanguage("java", java);
SyntaxHighlighter.registerLanguage("go", go);
SyntaxHighlighter.registerLanguage("cpp", cpp);
SyntaxHighlighter.registerLanguage("c", cpp);
SyntaxHighlighter.registerLanguage("diff", diff);
SyntaxHighlighter.registerLanguage("markdown", markdown);
SyntaxHighlighter.registerLanguage("md", markdown);
import { useUpdateWorkspace } from "@/hooks/useWorkspaces";
import { useChatHistory, useClearChatHistory } from "@/hooks/useChatHistory";
import { useRAGChatStream } from "@/hooks/useRAGChatStream";
import { StreamingMarkdown } from "@/components/rag/MemoizedMarkdown";
import { ThinkingTimeline } from "@/components/rag/ThinkingTimeline";
import type {
  ChatMessage,
  ChatImageRef,
  ChatSourceChunk,
  ChatStreamStatus,
  Document,
  KnowledgeBase,
  LLMCapabilities,
  AgentStep,
} from "@/types";

// Context to provide workspaceId and debugMode to nested components
const WsIdCtx = createContext<string>("");
const DebugCtx = createContext(false);

// Context: accumulated sources from ALL messages in the conversation.
// Used as fallback when a message references citation IDs from previous turns.
const AllSourcesCtx = createContext<ChatSourceChunk[]>([]);

/** Look up a Document from react-query cache by document_id */
function useFindDoc(documentId: number): Document | undefined {
  const wsId = useContext(WsIdCtx);
  const qc = useQueryClient();
  const docs = qc.getQueryData<Document[]>(["documents", wsId]);
  return docs?.find((d) => d.id === documentId);
}

// ---------------------------------------------------------------------------
// Helper: shorten filename for citation display
// ---------------------------------------------------------------------------
function shortenDocName(filename: string, maxLen = 14): string {
  const name = filename.replace(/\.[^.]+$/, ""); // strip extension
  if (name.length <= maxLen) return name;
  return name.slice(0, maxLen - 1) + "\u2026"; // ellipsis
}

// ---------------------------------------------------------------------------
// Citation badge — clickable [N] marker → icon + docname-P.N
// ---------------------------------------------------------------------------
function CitationLink({
  index,
  source,
  relatedEntities,
  isGrouped = false,
}: {
  index: string;
  source: ChatSourceChunk;
  relatedEntities: string[];
  isGrouped?: boolean;
}) {
  const { t } = useTranslation();
  const { activateCitation, activateCitationKG } = useWorkspaceStore();
  const doc = useFindDoc(source.document_id);

  const isKG = source.source_type === "kg";

  const handleContentClick = () => {
    if (isKG) {
      activateCitationKG(source, relatedEntities, doc);
    } else {
      activateCitation(source, relatedEntities, doc);
    }
  };

  if (isKG) {
    // KG source — purple chip with Brain icon
    return (
      <button
        onClick={handleContentClick}
        className={cn(
          "inline-flex items-center gap-0.5 h-[16px] px-1 mx-0.5 text-[9px] font-bold rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-all align-baseline",
          isGrouped && "mx-0",
        )}
        title={t("chat.viewInKG")}
      >
        <span>KG-{index}</span>
      </button>
    );
  }

  // Vector source — compact superscript-style citation
  const docName = doc?.original_filename
    ? shortenDocName(doc.original_filename)
    : `Source ${index}`;
  const label = `${index}`;

  return (
    <span className={cn("inline-flex items-baseline mx-0.5", isGrouped && "mx-0")}>
      <button
        onClick={handleContentClick}
        className={cn(
          "inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 text-[9px] font-bold rounded-sm bg-primary/10 text-primary hover:bg-primary/20 transition-all",
          "hover:scale-110 active:scale-95",
        )}
        title={t("chat.viewSource", {
          filename: doc?.original_filename || "unknown",
          page: source.page_no,
          label: `${docName}-P.${source.page_no || "?"}`,
        })}
      >
        {label}
      </button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Inline image badge — clickable [IMG-N] → icon + docname-P.N with preview
// ---------------------------------------------------------------------------
function InlineImageRef({
  imgRefId,
  imageRef,
  isGrouped = false,
}: {
  imgRefId: string;
  imageRef: ChatImageRef;
  isGrouped?: boolean;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const { activateImageCitation } = useWorkspaceStore();
  const doc = useFindDoc(imageRef.document_id);

  const handleClick = () => {
    setShowPreview((p) => !p);
    activateImageCitation(imageRef, doc);
  };

  return (
    <span className={cn("inline-flex flex-col mx-0.5 align-baseline", isGrouped && "mx-0")}>
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-0.5 h-[16px] px-1 text-[9px] font-bold rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all",
          "hover:scale-110 active:scale-95",
        )}
        title={imageRef.caption || `Image from page ${imageRef.page_no}`}
      >
        <ImageIcon className="w-2.5 h-2.5 shrink-0" />
        <span>IMG-{imgRefId}</span>
      </button>
      {showPreview && (
        <a
          href={imageRef.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-1 rounded-md overflow-hidden border bg-white max-w-[280px] hover:border-primary/50 transition-colors shadow-lg z-20"
        >
          <img
            src={imageRef.url}
            alt={imageRef.caption || `Image from page ${imageRef.page_no}`}
            className="w-full h-auto max-h-[180px] object-contain"
          />
          {imageRef.caption && (
            <span className="block px-2 py-1 text-[9px] text-muted-foreground leading-tight border-t bg-muted/30">
              p.{imageRef.page_no} — {imageRef.caption}
            </span>
          )}
        </a>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Process React children to replace [XXXX] and [IMG-XXXX] with interactive
// components. Supports both new [a3x9] and legacy [1] citation formats.
// Also handles grouped brackets like [a3x9, b2m7] by splitting into individual.
// ---------------------------------------------------------------------------
const CITATION_RE = /(\[(?:[a-z0-9]+|IMG-[a-z0-9]+)(?:,\s*(?:[a-z0-9]+|IMG-[a-z0-9]+))*\])/g;

function injectCitations(
  children: ReactNode,
  sources: ChatSourceChunk[],
  relatedEntities: string[],
  imageRefs?: ChatImageRef[],
  fallbackSources?: ChatSourceChunk[],
): ReactNode {
  return Children.map(children, (child) => {
    // Process string nodes — split on citation patterns
    if (typeof child === "string") {
      const parts = child.split(CITATION_RE);
      if (parts.length === 1) return child;
      const result: ReactNode[] = [];
      parts.forEach((part, i) => {
        // Check if this part is a bracket group
        const bracketMatch = part.match(/^\[(.+)\]$/);
        if (!bracketMatch) {
          if (part) result.push(part);
          return;
        }
        // Split on commas for grouped citations [a3x9, b2m7]
        const tokens = bracketMatch[1].split(/,\s*/);
        const citationComponents: ReactNode[] = [];

        tokens.forEach((token, ti) => {
          const key = `${i}-${ti}`;
          // Image citation: IMG-xxxx
          const imgMatch = token.match(/^IMG-(.+)$/);
          if (imgMatch && imageRefs && imageRefs.length > 0) {
            const imgId = imgMatch[1];
            const imageRef =
              imageRefs.find((ir) => ir.ref_id === imgId) ?? imageRefs[parseInt(imgId, 10) - 1];
            if (imageRef) {
              citationComponents.push(
                <InlineImageRef
                  key={key}
                  imgRefId={imgId}
                  imageRef={imageRef}
                  isGrouped={tokens.length > 1}
                />,
              );
              return;
            }
          }
          // Text citation
          const source =
            sources.find((s) => String(s.index) === token) ??
            (fallbackSources ? fallbackSources.find((s) => String(s.index) === token) : undefined);
          if (source) {
            citationComponents.push(
              <CitationLink
                key={key}
                index={String(source.index)}
                source={source}
                relatedEntities={relatedEntities}
                isGrouped={tokens.length > 1}
              />,
            );
            return;
          }
          citationComponents.push(`[${token}]`);
        });

        if (tokens.length > 1) {
          result.push(
            <span
              key={i}
              className="inline-flex items-baseline rounded-sm bg-muted/30 px-0.5 mx-0.5"
            >
              {citationComponents}
            </span>,
          );
        } else {
          result.push(...citationComponents);
        }
      });
      return result;
    }
    // Recurse into React elements that have children
    if (
      isValidElement(child) &&
      child.props &&
      (child.props as { children?: ReactNode }).children
    ) {
      const props = child.props as { children?: ReactNode };
      return Object.assign({}, child, {
        props: {
          ...child.props,
          children: injectCitations(
            props.children,
            sources,
            relatedEntities,
            imageRefs,
            fallbackSources,
          ),
        },
      });
    }
    return child;
  });
}

// ---------------------------------------------------------------------------
// Preprocess markdown: fix common LLM output issues
// ---------------------------------------------------------------------------
function preprocessMarkdown(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  let prevWasTable = false;
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
    }

    const isTable =
      (trimmed.startsWith("|") && trimmed.endsWith("|")) || /^\|[\s:|-]+\|$/.test(trimmed);

    // Insert blank line when transitioning from table row to non-table content
    if (prevWasTable && !isTable && trimmed !== "") {
      result.push("");
    }

    // Convert single-line display math $$content$$ to multi-line format
    if (
      !inCodeFence &&
      trimmed.startsWith("$$") &&
      trimmed.endsWith("$$") &&
      trimmed.length > 4 &&
      trimmed !== "$$"
    ) {
      const mathContent = trimmed.slice(2, -2);
      result.push("$$");
      result.push(mathContent);
      result.push("$$");
    } else {
      result.push(line);
    }

    prevWasTable = isTable;
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// Extract raw text from React node tree (for code blocks)
// ---------------------------------------------------------------------------
function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return "";
}

// ---------------------------------------------------------------------------
// Code block with syntax highlighting + copy button
// ---------------------------------------------------------------------------
function CodeBlock({ language, children }: { language: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const isDark = theme === "dark";
  const code = extractText(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="group relative my-2">
      {language && (
        <span className="absolute top-2 right-2 text-[9px] uppercase text-muted-foreground/40 font-mono select-none z-10 pointer-events-none">
          {language}
        </span>
      )}
      <button
        onClick={handleCopy}
        className={cn(
          "absolute top-2 left-2 p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground transition-all opacity-0 group-hover:opacity-100 z-10",
          isDark ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10",
        )}
        title={t("chat.copyCode")}
      >
        {copied ? (
          <ClipboardCheck className="w-3 h-3 text-emerald-500" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
      <SyntaxHighlighter
        language={language}
        style={isDark ? oneDark : oneLight}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "8px",
          fontSize: "12px",
          padding: "10px 12px",
          ...(isDark
            ? {
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
              }
            : {
                background: "oklch(0.96 0.008 105)",
                border: "1px solid oklch(0.88 0.018 105)",
              }),
        }}
        codeTagProps={{ style: { fontFamily: '"IBM Plex Mono", "Fira Code", monospace' } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Markdown renderer with inline citation links + LaTeX + code blocks
// ---------------------------------------------------------------------------
function MarkdownWithCitations({
  content,
  sources,
  relatedEntities,
  imageRefs,
}: {
  content: string;
  sources: ChatSourceChunk[];
  relatedEntities: string[];
  imageRefs?: ChatImageRef[];
}) {
  const processed = preprocessMarkdown(content);

  // Fallback: accumulated sources from all messages in the conversation.
  // When the model references citation IDs from previous answers (e.g. when
  // it didn't call search_documents), we can still render them as links.
  const allSources = useContext(AllSourcesCtx);

  const withCitations = <T extends keyof JSX.IntrinsicElements>(tag: T) => {
    return (props: JSX.IntrinsicElements[T] & ExtraProps) => {
      const { children, ...rest } = props;
      const injected = injectCitations(children, sources, relatedEntities, imageRefs, allSources);
      return createElement(tag, rest as JSX.IntrinsicElements[T], injected);
    };
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p: withCitations("p"),
        li: withCitations("li"),
        td: withCitations("td"),
        th: withCitations("th"),
        h1: withCitations("h1"),
        h2: withCitations("h2"),
        h3: withCitations("h3"),
        h4: withCitations("h4"),
        h5: withCitations("h5"),
        h6: withCitations("h6"),
        strong: withCitations("strong"),
        em: withCitations("em"),
        a: ({ href, children, ...props }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {injectCitations(children, sources, relatedEntities, imageRefs, allSources)}
          </a>
        ),
        code: ({
          className,
          children,
          ...props
        }: ComponentPropsWithoutRef<"code"> & ExtraProps) => {
          const langMatch = /language-(\w+)/.exec(className || "");
          // Inline code (no language class)
          if (!langMatch) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
          // Fenced code block → syntax highlighted
          return <CodeBlock language={langMatch[1]}>{children}</CodeBlock>;
        },
      }}
    >
      {processed}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// Source Rating Buttons
// ---------------------------------------------------------------------------
type RelevanceRating = "relevant" | "partial" | "not_relevant";

function SourceRatingButtons({
  sourceIndex,
  currentRating,
  onRate,
}: {
  sourceIndex: string;
  currentRating?: RelevanceRating;
  onRate: (sourceIndex: string, rating: RelevanceRating) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center gap-0.5 ml-auto shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate(sourceIndex, "relevant");
        }}
        className={cn(
          "p-0.5 rounded transition-colors",
          currentRating === "relevant"
            ? "text-emerald-500"
            : "text-muted-foreground/20 hover:text-emerald-500/60",
        )}
        title={t("chat.relevant")}
      >
        <ThumbsUp className="w-2.5 h-2.5" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRate(sourceIndex, "not_relevant");
        }}
        className={cn(
          "p-0.5 rounded transition-colors",
          currentRating === "not_relevant"
            ? "text-destructive"
            : "text-muted-foreground/20 hover:text-destructive/60",
        )}
        title={t("chat.notRelevant")}
      >
        <ThumbsDown className="w-2.5 h-2.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sources panel — shows the retrieved chunks
// ---------------------------------------------------------------------------
function SourcesPanel({ sources, messageId }: { sources: ChatSourceChunk[]; messageId?: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [ratings, setRatings] = useState<Record<string, RelevanceRating>>({});
  const { activateCitation, activateCitationKG } = useWorkspaceStore();
  const wsId = useContext(WsIdCtx);
  const debugMode = useContext(DebugCtx);

  if (sources.length === 0) return null;

  const vectorSources = sources.filter((s) => s.source_type !== "kg");
  const kgSources = sources.filter((s) => s.source_type === "kg");

  const handleRate = async (sourceIndex: string, rating: RelevanceRating) => {
    // Toggle: click same rating to un-rate
    const newRating = ratings[sourceIndex] === rating ? "partial" : rating;
    const prev = { ...ratings };
    setRatings((r) => ({ ...r, [sourceIndex]: newRating }));

    if (!messageId || !wsId) return;
    try {
      await api.post(`/rag/chat/${wsId}/rate`, {
        message_id: messageId,
        source_index: sourceIndex,
        rating: newRating,
      });
    } catch {
      setRatings(prev); // rollback
    }
  };

  return (
    <div className="mt-2 rounded-md border bg-muted/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-muted-foreground/80 hover:text-foreground transition-all hover:bg-muted/30"
      >
        <div className="flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider">
            {vectorSources.length} {t("chat.sources")}
            {kgSources.length > 0 && " + KG"}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 ml-auto transition-transform duration-300",
            expanded && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="divide-y border-t">
              {vectorSources.map((source) => (
                <div
                  key={source.chunk_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => activateCitation(source, [])}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activateCitation(source, []);
                    }
                  }}
                  className="w-full text-left px-2.5 py-2 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-primary/15 text-primary">
                      {source.index}
                    </span>
                    <span className="text-[10px] text-muted-foreground">p.{source.page_no}</span>
                    {source.heading_path.length > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 truncate">
                        {source.heading_path.join(" > ")}
                      </span>
                    )}
                    {messageId && (
                      <SourceRatingButtons
                        sourceIndex={String(source.index)}
                        currentRating={ratings[String(source.index)]}
                        onRate={handleRate}
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-foreground/70 line-clamp-2 leading-relaxed">
                    {source.content.slice(0, 150)}
                    {source.content.length > 150 ? "..." : ""}
                  </p>
                  {debugMode && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] px-1 py-0.5 rounded bg-muted font-mono text-muted-foreground/70">
                        score: {source.score.toFixed(3)}
                      </span>
                      <span className="text-[8px] px-1 py-0.5 rounded font-medium bg-blue-400/15 text-blue-400">
                        {source.source_type || "vector"}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {kgSources.map((source) => (
                <div
                  key={source.chunk_id}
                  role="button"
                  tabIndex={0}
                  onClick={() => activateCitationKG(source, [])}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activateCitationKG(source, []);
                    }
                  }}
                  className="w-full text-left px-2.5 py-2 hover:bg-purple-400/5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full bg-purple-400/15 text-purple-400">
                      {source.index}
                    </span>
                    <span className="text-[10px] text-purple-400 font-medium">Knowledge Graph</span>
                    {messageId && (
                      <SourceRatingButtons
                        sourceIndex={String(source.index)}
                        currentRating={ratings[String(source.index)]}
                        onRate={handleRate}
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-foreground/70 line-clamp-2 leading-relaxed">
                    {source.content.slice(0, 150)}
                    {source.content.length > 150 ? "..." : ""}
                  </p>
                  {debugMode && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[8px] px-1 py-0.5 rounded bg-muted font-mono text-muted-foreground/70">
                        score: {source.score.toFixed(3)}
                      </span>
                      <span className="text-[8px] px-1 py-0.5 rounded font-medium bg-purple-400/15 text-purple-400">
                        kg
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image references panel — shows retrieved images in chat
// ---------------------------------------------------------------------------
function ImageRefCard({ img }: { img: ChatImageRef }) {
  const { activateImageCitation } = useWorkspaceStore();
  const doc = useFindDoc(img.document_id);
  return (
    <button
      onClick={() => activateImageCitation(img, doc)}
      className="group block rounded-md overflow-hidden border bg-background hover:border-primary/50 transition-colors text-left cursor-pointer"
    >
      <img
        src={img.url}
        alt={img.caption || `Image from page ${img.page_no}`}
        className="w-full h-auto max-h-[200px] object-contain bg-white"
        loading="lazy"
      />
      {img.caption && (
        <p className="px-2 py-1 text-[10px] text-muted-foreground leading-tight line-clamp-2 border-t">
          p.{img.page_no} — {img.caption}
        </p>
      )}
    </button>
  );
}

function ImageRefsPanel({ images }: { images: ChatImageRef[] }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  if (images.length === 0) return null;

  return (
    <div className="mt-2 rounded-md border bg-muted/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ImageIcon className="w-3 h-3" />
        {t("chat.imagesFromDocs", { count: images.length })}
        <span className="ml-auto text-[10px]">{expanded ? "▲" : "▼"}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="p-2 grid gap-2"
              style={{
                gridTemplateColumns:
                  images.length === 1 ? "1fr" : "repeat(auto-fit, minmax(140px, 1fr))",
              }}
            >
              {images.map((img) => (
                <ImageRefCard key={img.image_id} img={img} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thinking panel — collapsible violet-themed thinking process display
// ---------------------------------------------------------------------------
function ThinkingPanel({ thinking }: { thinking: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (!thinking) return null;

  return (
    <div className="mt-2 mb-1.5 rounded-xl border border-violet-500/20 bg-violet-500/5 shadow-sm overflow-hidden transition-all">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-violet-400 hover:text-violet-300 in-data-[theme='light']:text-violet-600 in-data-[theme='light']:hover:text-violet-700 transition-all hover:bg-violet-500/5"
      >
        <Brain className="w-3.5 h-3.5" />
        <span className="uppercase tracking-wider">{t("chat.thinkingProcess")}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 ml-auto transition-transform duration-300",
            expanded && "rotate-180",
          )}
        />
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 border-t border-violet-500/10">
              <pre className="text-[11px] text-violet-300/90 in-data-[theme='light']:text-violet-700/90 whitespace-pre-wrap leading-relaxed mt-1.5 max-h-[300px] overflow-y-auto">
                {thinking}
              </pre>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Copy message actions — plain text or raw markdown (without citations)
// ---------------------------------------------------------------------------
const CITATION_STRIP_RE = /\s*\[(?:[a-z0-9]+|IMG-[a-z0-9]+)(?:,\s*(?:[a-z0-9]+|IMG-[a-z0-9]+))*\]/g;

/** Remove citation references like [a3x9], [IMG-p4f2], [a3x9, b2m7] */
function stripCitations(md: string): string {
  return md
    .replace(CITATION_STRIP_RE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Convert markdown to plain text: strip formatting, links, images, code fences */
function markdownToPlainText(md: string): string {
  let text = stripCitations(md);
  text = text.replace(/```[\s\S]*?```/g, (m) => {
    const lines = m.split("\n");
    return lines.slice(1, -1).join("\n");
  });
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  text = text.replace(/\*\*(.+?)\*\*/g, "$1");
  text = text.replace(/\*(.+?)\*/g, "$1");
  text = text.replace(/__(.+?)__/g, "$1");
  text = text.replace(/_(.+?)_/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

function CopyMessageActions({ content }: { content: string }) {
  const { t } = useTranslation();
  const [copiedMode, setCopiedMode] = useState<"text" | "markdown" | null>(null);

  const handleCopy = useCallback(
    (mode: "text" | "markdown") => {
      const value = mode === "text" ? markdownToPlainText(content) : stripCitations(content);
      navigator.clipboard.writeText(value).then(() => {
        setCopiedMode(mode);
        setTimeout(() => setCopiedMode(null), 2000);
      });
    },
    [content],
  );

  return (
    <div className="flex items-center gap-0.5 mt-1.5">
      <button
        onClick={() => handleCopy("text")}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 transition-all text-[10px]"
        title={t("chat.copyPlainText")}
      >
        {copiedMode === "text" ? (
          <ClipboardCheck className="w-3 h-3 text-emerald-500" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
        <span>{copiedMode === "text" ? t("common.copied") : t("chat.copyPlainText")}</span>
      </button>
      <button
        onClick={() => handleCopy("markdown")}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 transition-all text-[10px]"
        title={t("chat.copyMarkdown")}
      >
        {copiedMode === "markdown" ? (
          <ClipboardCheck className="w-3 h-3 text-emerald-500" />
        ) : (
          <FileCode className="w-3 h-3" />
        )}
        <span>{copiedMode === "markdown" ? t("common.copied") : t("chat.copyMarkdown")}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single message bubble
// ---------------------------------------------------------------------------
const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  const proseClasses = cn(
    "prose prose-sm max-w-none text-foreground/90",
    "[&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-1",
    "[&_pre]:bg-transparent [&_pre]:border-none [&_pre]:p-0 [&_pre]:m-0",
    "[&_code]:bg-muted/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.85em] [&_code]:text-foreground/90 [&_code]:font-mono",
    "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_a]:decoration-primary/30 hover:[&_a]:decoration-primary transition-all",
    "[&_strong]:text-foreground [&_strong]:font-bold",
    "[&_em]:text-foreground/80 [&_em]:italic",
    "[&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_h4]:text-foreground",
    "[&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
    "[&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5",
    "[&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-2.5 [&_h3]:mb-1",
    "[&_blockquote]:border-l-4 [&_blockquote]:border-primary/20 [&_blockquote]:pl-4 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:text-foreground/70 [&_blockquote]:bg-primary/5 [&_blockquote]:rounded-r-lg",
    "[&_table]:text-[13px] [&_table]:my-4 [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2 [&_th]:text-foreground/90 [&_td]:text-foreground/80 [&_th]:bg-muted/50 [&_table]:border-collapse [&_table]:w-full",
    "[&_li]:text-foreground/90",
    "[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-3",
    "[&_.katex]:text-[1em]",
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2 group/message", isUser ? "justify-end" : "justify-start")}
    >
      {/* Assistant: Bot icon with glow ring during streaming */}
      {!isUser && (
        <div className="relative w-6 h-6 shrink-0 mt-1">
          {message.isStreaming && <div className="icon-glow-ring animate-pulse" />}
          <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shadow-sm border border-primary/10">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
        </div>
      )}

      <div
        className={cn(
          "relative transition-all duration-300",
          isUser
            ? "max-w-[85%] rounded-2xl px-4 py-2 bg-secondary/50 shadow-sm"
            : cn(
                "max-w-[92%] min-w-0 py-1 px-1 rounded-2xl",
                message.isStreaming && "bg-linear-to-b from-primary/5 to-transparent",
              ),
        )}
      >
        {/* ThinkingTimeline — single instance, never unmounts between streaming→completed */}
        {!isUser && message.agentSteps && message.agentSteps.length > 0 && (
          <ThinkingTimeline
            steps={message.agentSteps}
            mode={message.isStreaming ? "live" : "embedded"}
            className={cn("mb-1.5", message.isStreaming && "mt-1")}
            autoCollapse={message.isStreaming && !!message.content}
          />
        )}

        {/* Typing indicator — only when streaming with no steps and no content yet */}
        {!isUser && message.isStreaming && !message.content && !message.agentSteps?.length && (
          <TypingIndicator status="analyzing" />
        )}

        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : message.isStreaming ? (
          message.content ? (
            <div
              className={cn(proseClasses, "relative transition-opacity duration-500")}
              style={{
                maskImage: "linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)",
                WebkitMaskImage:
                  "linear-gradient(to bottom, black calc(100% - 40px), transparent 100%)",
              }}
            >
              <StreamingMarkdown
                content={message.content}
                isStreaming
                renderBlock={(block) => (
                  <MarkdownWithCitations
                    content={block}
                    sources={message.sources || []}
                    relatedEntities={message.relatedEntities || []}
                    imageRefs={message.imageRefs}
                  />
                )}
              />
              <span className="streaming-cursor" />
            </div>
          ) : message.thinking ? (
            <InlineThinkingPreview text={message.thinking} />
          ) : null
        ) : (
          <div className={proseClasses}>
            <MarkdownWithCitations
              content={message.content}
              sources={message.sources || []}
              relatedEntities={message.relatedEntities || []}
              imageRefs={message.imageRefs}
            />
          </div>
        )}

        {/* Copy actions for assistant messages */}
        {!isUser && message.content && <CopyMessageActions content={message.content} />}

        {/* ThinkingPanel — only when no ThinkingTimeline with thinking log (avoid duplication) */}
        {!isUser &&
          message.thinking &&
          !message.isStreaming &&
          !message.agentSteps?.some((s) => s.thinkingText) && (
            <ThinkingPanel thinking={message.thinking} />
          )}

        {!isUser && !message.isStreaming && message.sources && message.sources.length > 0 && (
          <SourcesPanel sources={message.sources} messageId={message.id} />
        )}

        {!isUser && !message.isStreaming && message.imageRefs && message.imageRefs.length > 0 && (
          <ImageRefsPanel images={message.imageRefs} />
        )}

        <p
          className={cn(
            "text-[9px] mt-1",
            isUser ? "text-muted-foreground/50" : "text-muted-foreground/50",
          )}
        >
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {isUser && (
        <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      )}
    </motion.div>
  );
});

// ---------------------------------------------------------------------------
// Inline thinking preview — shown in message body while model is thinking
// ---------------------------------------------------------------------------

function InlineThinkingPreview({ text }: { text: string }) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledRef = useRef(false);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    isUserScrolledRef.current = !isAtBottom;
  }, []);

  useEffect(() => {
    if (containerRef.current && !isUserScrolledRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [text]);

  return (
    <div className="mt-2 p-3 rounded-xl border border-violet-500/20 bg-violet-500/5 shadow-[0_0_15px_-5px_rgba(139,92,246,0.1)] transition-all">
      <div className="flex items-center gap-1.5 mb-2">
        <div className="relative">
          <div className="absolute inset-0 bg-violet-400 blur-md opacity-20 animate-pulse" />
          <Brain className="w-3.5 h-3.5 text-violet-400 relative" />
        </div>
        <span className="text-xs font-bold text-violet-400/90 tracking-tight uppercase">
          {t("chat.thinking")}
        </span>
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={cn(
          "text-xs leading-relaxed text-muted-foreground/60 font-mono",
          "max-h-[180px] overflow-y-auto scrollbar-none",
          "border-l border-violet-500/20 pl-3 ml-1",
          "whitespace-pre-wrap wrap-break-word",
        )}
      >
        {text}
        <span className="animate-pulse text-violet-400 font-bold ml-0.5">_</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typing indicator
// ---------------------------------------------------------------------------
function TypingIndicator({ status }: { status?: ChatStreamStatus }) {
  const { t } = useTranslation();
  const label =
    status === "analyzing"
      ? t("chat.analyzingQuestion")
      : status === "retrieving"
        ? t("chat.searchingDocs")
        : status === "generating"
          ? t("chat.generatingAnswer")
          : t("workspace.analyzing");
  return (
    <div className="flex gap-2 items-start">
      <div className="relative w-6 h-6 shrink-0">
        <div className="icon-glow-ring" />
        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
          <Bot className="w-3.5 h-3.5 text-primary" />
        </div>
      </div>
      <div className="py-1">
        <div className="flex items-center gap-1.5">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestion chips (empty state)
// ---------------------------------------------------------------------------
function SuggestionChips({ onSelect }: { onSelect: (q: string) => void }) {
  const { t } = useTranslation();
  const suggestions = [
    t("chat.suggestions.summarize"),
    t("chat.suggestions.topics"),
    t("chat.suggestions.entities"),
    t("chat.suggestions.methodology"),
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Background Decorative Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center z-10"
      >
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
          <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20 relative border border-white/20">
            <Bot className="w-8 h-8 text-white" />
          </div>
        </div>

        <h3 className="text-xl font-bold mb-2 tracking-tight">{t("chat.aiAssistant")}</h3>
        <p className="text-sm text-muted-foreground mb-8 max-w-[280px] leading-relaxed">
          {t("chat.assistantDesc")}
        </p>

        <div className="grid grid-cols-2 gap-3 max-w-[400px]">
          {suggestions.map((s, i) => (
            <motion.button
              key={s}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => onSelect(s)}
              className={cn(
                "group relative flex items-center justify-center text-xs px-4 py-3 rounded-xl border bg-card/50 backdrop-blur-sm transition-all",
                "hover:border-primary/50 hover:bg-primary/5 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-1",
                "text-muted-foreground hover:text-foreground font-medium",
              )}
            >
              <span className="relative z-10">{s}</span>
              <div className="absolute inset-0 rounded-xl bg-linear-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel — main export
// ---------------------------------------------------------------------------
const DEFAULT_SYSTEM_PROMPT =
  "You are a document Q&A assistant. Your goal is to write an accurate, " +
  "detailed, and comprehensive answer to the user's question, drawing from " +
  "the provided document sources. You will be given retrieved document sources " +
  "from a knowledge base to help you answer. Your answer should be informed by " +
  "these provided sources. Your answer must be self-contained and respond fully " +
  "to the question. Your answer must be correct, high-quality, well-formatted, " +
  "and written by an expert using an unbiased and journalistic tone.\n\n" +
  "## Core Behavior\n" +
  "- Answer questions ONLY using the provided document sources. " +
  "Do NOT add any information from your own knowledge.\n" +
  "- Extract ALL relevant information from sources: numbers, percentages, " +
  "dates, names, statistics, data from tables, and specific details.\n" +
  "- You may synthesize, compare, and draw logical conclusions from " +
  "multiple sources when the question requires it.\n" +
  "- If sources contain partial information, use what is available and " +
  "clearly note what is missing.\n" +
  "- When asked about specific data, always provide exact numbers rather " +
  "than vague descriptions.\n\n" +
  "## Question Type Handling\n\n" +
  "**Factual / Data:** Direct answers with exact figures, percentages, " +
  "time periods. Present multi-row data in tables.\n\n" +
  "**Comparison / Analysis:** Use Markdown tables for side-by-side comparisons. " +
  "Draw logical conclusions from data.\n\n" +
  "**Technical / Academic:** Long detailed answers with sections and headings. " +
  "Include formulas (LaTeX), code blocks.\n\n" +
  "**Summary:** Organize by themes, not by source document. " +
  "Highlight key findings.\n\n" +
  "**Coding:** Use ```language code blocks. Code first, explain after.\n\n" +
  "**Science / Math:** Include formulas in LaTeX. For simple calculations, " +
  "answer with final result.\n\n" +
  "## Reasoning\n" +
  "- Determine question type and apply appropriate handling.\n" +
  "- Break complex questions into sub-questions.\n" +
  "- A partial correct answer is better than a complete wrong one.\n" +
  "- Make sure your answer addresses ALL parts of the question.\n\n" +
  "## Response Quality\n" +
  "- Prioritize accuracy over completeness.\n" +
  "- When sources conflict, acknowledge and present both perspectives.\n" +
  "- NEVER say 'information not found' when data IS present in any source.\n" +
  "- If the premise is incorrect based on sources, explain why.";

// Hard rules always appended — shown in tooltip, not editable

interface ChatPanelProps {
  workspaceId: string;
  hasIndexedDocs: boolean;
  workspace: KnowledgeBase | null;
}

export const ChatPanel = memo(function ChatPanel({
  workspaceId,
  hasIndexedDocs,
  workspace,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [enableThinking, setEnableThinking] = useState(false);
  const [thinkingDefaultSynced, setThinkingDefaultSynced] = useState(false);
  const [forceSearch, setForceSearch] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Load chat history from PostgreSQL
  const { data: historyData, isLoading: historyLoading } = useChatHistory(workspaceId);
  const clearMutation = useClearChatHistory(workspaceId);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [promptDraft, setPromptDraft] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnimRef = useRef<number | undefined>(undefined);
  const spacerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Debug mode (Ctrl+Shift+D toggle, persisted in localStorage)
  const [debugMode, setDebugMode] = useState(
    () => localStorage.getItem("prismrag-debug-mode") === "true",
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setDebugMode((prev) => {
          const next = !prev;
          localStorage.setItem("prismrag-debug-mode", String(next));
          toast.success(next ? t("chat.debugOn") : t("chat.debugOff"));
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [t]);

  // System prompt editor
  const updateWorkspaceMutation = useUpdateWorkspace();
  const savedPrompt = workspace?.system_prompt ?? "";
  const effectivePrompt = savedPrompt || DEFAULT_SYSTEM_PROMPT;
  const isCustom = !!savedPrompt;

  // Sync draft when workspace data loads/changes
  useEffect(() => {
    setPromptDraft(effectivePrompt);
  }, [effectivePrompt]);

  const promptIsDirty = promptDraft !== effectivePrompt;

  const handleSavePrompt = useCallback(() => {
    if (!workspace) return;
    // If draft equals default, save empty string → reset to default in DB
    const toSave = promptDraft.trim() === DEFAULT_SYSTEM_PROMPT ? "" : promptDraft;
    updateWorkspaceMutation.mutate(
      { id: workspace.id, data: { system_prompt: toSave } },
      { onSuccess: () => toast.success(t("chat.systemPromptSaved")) },
    );
  }, [workspace, promptDraft, updateWorkspaceMutation, t]);

  const handleResetPrompt = useCallback(() => {
    if (!workspace) return;
    setPromptDraft(DEFAULT_SYSTEM_PROMPT);
    updateWorkspaceMutation.mutate(
      { id: workspace.id, data: { system_prompt: "" } },
      { onSuccess: () => toast.success(t("chat.systemPromptReset")) },
    );
  }, [workspace, updateWorkspaceMutation, t]);

  // Check LLM capabilities (thinking support)
  const { data: capabilities } = useQuery<LLMCapabilities>({
    queryKey: ["llm-capabilities"],
    queryFn: () => api.get<LLMCapabilities>("/rag/capabilities"),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 1,
  });
  const thinkingSupported = capabilities?.supports_thinking ?? false;

  // Sync thinking toggle default from server (once per mount)
  useEffect(() => {
    if (capabilities && !thinkingDefaultSynced) {
      setEnableThinking(capabilities.thinking_default);
      setThinkingDefaultSynced(true);
    }
  }, [capabilities, thinkingDefaultSynced]);

  // Sync DB history → local messages state when data loads.
  // IMPORTANT: preserve agentSteps from local state — they are client-side only (not stored in DB).
  // Without this, queryClient.invalidateQueries after streaming overwrites agentSteps → ThinkingTimeline disappears.
  useEffect(() => {
    if (historyData?.messages) {
      setMessages((prev) => {
        // Build a map of existing agentSteps by message id so we can re-attach them after DB sync
        const stepsMap = new Map<string, AgentStep[]>();
        for (const m of prev) {
          if (m.agentSteps?.length) stepsMap.set(m.id, m.agentSteps);
        }
        return historyData.messages.map((m) => ({
          id: m.message_id,
          role: m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources ?? undefined,
          relatedEntities: m.related_entities ?? undefined,
          imageRefs: m.image_refs ?? undefined,
          thinking: m.thinking ?? undefined,
          timestamp: m.created_at,
          // Priority: local live steps (from current session) > DB-persisted synthetic steps
          agentSteps:
            stepsMap.get(m.message_id) ??
            (m.agent_steps?.length ? (m.agent_steps as AgentStep[]) : undefined),
        }));
      });
    }
  }, [historyData]);

  // SSE streaming chat
  const stream = useRAGChatStream(workspaceId);
  const streamingMsgIdRef = useRef<string | null>(null);
  // Snapshot agentSteps into a ref so finalize always has fresh data
  const agentStepsRef = useRef<AgentStep[]>([]);
  useEffect(() => {
    if (stream.agentSteps.length > 0) {
      agentStepsRef.current = stream.agentSteps;
    }
  }, [stream.agentSteps]);

  // Double-rAF + easeOutCubic scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Cancel in-progress animation
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = undefined;
    }

    // Double rAF: ensure React commit + browser paint before measuring
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const target = el.scrollHeight - el.clientHeight;
        if (!smooth || Math.abs(target - el.scrollTop) < 10) {
          el.scrollTop = target;
          return;
        }

        const start = el.scrollTop;
        const distance = target - start;
        const duration = 400;
        const startTime = performance.now();

        const scrollEl = el; // capture for closure
        function animate(now: number) {
          const progress = Math.min((now - startTime) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          scrollEl.scrollTop = start + distance * ease;
          if (progress < 1) {
            scrollAnimRef.current = requestAnimationFrame(animate);
          } else {
            scrollAnimRef.current = undefined;
          }
        }

        scrollAnimRef.current = requestAnimationFrame(animate);
      });
    });
  }, []);

  // Scroll user message to top of chat area
  const scrollUserMsgToTop = useCallback((msgId: string) => {
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = undefined;
    }
    // Double rAF: wait for React commit + browser paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Ensure spacer is set before scrolling (useEffect may not have run yet)
        if (spacerRef.current) {
          spacerRef.current.style.height = `${container.clientHeight}px`;
        }

        const el = container.querySelector(`[data-message-id="${msgId}"]`) as HTMLElement | null;
        if (!el) return;

        // Use getBoundingClientRect for accurate position relative to scroll container
        // (offsetTop is relative to offsetParent, not scroll container)
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const relativeTop = elRect.top - containerRect.top + container.scrollTop;

        const PADDING_TOP = 12;
        const start = container.scrollTop;
        const target = Math.max(0, relativeTop - PADDING_TOP);
        if (Math.abs(target - start) < 5) return;

        const distance = target - start;
        const duration = 380;
        const startTime = performance.now();

        function animate(now: number) {
          const progress = Math.min((now - startTime) / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          container!.scrollTop = start + distance * ease;
          if (progress < 1) {
            scrollAnimRef.current = requestAnimationFrame(animate);
          } else {
            scrollAnimRef.current = undefined;
          }
        }
        scrollAnimRef.current = requestAnimationFrame(animate);
      });
    });
  }, []);

  // Keep spacer height = container height so user message can always scroll to top
  const hasMessages = messages.length > 0;
  useEffect(() => {
    if (!hasMessages) return;
    const container = scrollContainerRef.current;
    if (!container) return;

    const updateSpacer = () => {
      if (spacerRef.current) {
        spacerRef.current.style.height = `${container.clientHeight}px`;
      }
    };
    const handleScrollEvent = () => {
      const threshold = 150;
      const isScrolledUp =
        container.scrollHeight - container.clientHeight - container.scrollTop > threshold;
      setShowScrollButton(isScrolledUp);
    };

    updateSpacer();
    container.addEventListener("scroll", handleScrollEvent);
    const observer = new ResizeObserver(updateSpacer);
    observer.observe(container);
    return () => {
      container.removeEventListener("scroll", handleScrollEvent);
      observer.disconnect();
    };
  }, [hasMessages]);

  // Reset spacer when streaming ends; track transition to avoid spurious scrollToBottom
  const prevIsStreamingRef = useRef(false);
  const justFinishedStreamingRef = useRef(false);
  useEffect(() => {
    if (prevIsStreamingRef.current && !stream.isStreaming) {
      // Streaming just ended: reset spacer and mark so scrollToBottom skips this cycle
      if (spacerRef.current) {
        spacerRef.current.style.height = "0px";
      }
      justFinishedStreamingRef.current = true;
    }
    prevIsStreamingRef.current = stream.isStreaming;
  }, [stream.isStreaming]);

  // Auto-scroll only on non-streaming message changes (history load, etc.)
  // Skip when streaming just ended — viewport already shows end of AI response
  useEffect(() => {
    if (!stream.isStreaming) {
      if (justFinishedStreamingRef.current) {
        justFinishedStreamingRef.current = false;
        return;
      }
      scrollToBottom();
    }
  }, [messages, stream.isStreaming, scrollToBottom]);

  // Sync streaming content + agentSteps → messages state for the streaming message
  useEffect(() => {
    if (!stream.isStreaming || !streamingMsgIdRef.current) return;
    const id = streamingMsgIdRef.current;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx === -1) return prev;
      const m = prev[idx];

      // Bail out if nothing actually changed — prevents infinite re-render
      const newContent = stream.streamingContent;
      const newSources = stream.pendingSources.length > 0 ? stream.pendingSources : m.sources;
      const newImages = stream.pendingImages.length > 0 ? stream.pendingImages : m.imageRefs;
      const newThinking = stream.thinkingText || m.thinking;
      const newSteps = stream.agentSteps.length > 0 ? stream.agentSteps : m.agentSteps;

      if (
        m.content === newContent &&
        m.sources === newSources &&
        m.imageRefs === newImages &&
        m.thinking === newThinking &&
        m.agentSteps === newSteps
      ) {
        return prev; // no change → skip setMessages re-render
      }

      const updated = [...prev];
      updated[idx] = {
        ...m,
        content: newContent,
        sources: newSources,
        imageRefs: newImages,
        thinking: newThinking,
        agentSteps: newSteps,
      };
      return updated;
    });
  }, [
    stream.streamingContent,
    stream.pendingSources,
    stream.pendingImages,
    stream.thinkingText,
    stream.isStreaming,
    stream.agentSteps,
  ]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text || input).trim();
      if (!msg || stream.isStreaming) return;

      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: msg,
        timestamp: new Date().toISOString(),
      };

      // Add placeholder assistant message for streaming
      const assistantId = generateId();
      streamingMsgIdRef.current = assistantId;
      const placeholderMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, placeholderMsg]);
      setInput("");
      // Scroll new user message to top so agent response fills the space below
      scrollUserMsgToTop(userMsg.id);

      // Build history from previous messages (exclude the new user + placeholder)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const finalMsg = await stream.sendMessage(
        msg,
        history,
        thinkingSupported && enableThinking,
        forceSearch,
      );

      // Finalize the streaming message (prefer finalMsg.agentSteps — directly from SSE loop,
      // fallback to ref snapshot, then to what was synced into the message during streaming)
      if (finalMsg) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...finalMsg,
                  id: assistantId,
                  isStreaming: false,
                  agentSteps: finalMsg.agentSteps?.length
                    ? finalMsg.agentSteps
                    : agentStepsRef.current.length > 0
                      ? agentStepsRef.current
                      : m.agentSteps,
                }
              : m,
          ),
        );
      } else if (stream.error) {
        toast.error("Chat failed: " + stream.error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: m.content || "Sorry, I encountered an error. Please try again.",
                  isStreaming: false,
                }
              : m,
          ),
        );
      } else {
        // Cancelled — keep partial content
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m)),
        );
      }
      streamingMsgIdRef.current = null;
    },
    [input, messages, stream, thinkingSupported, enableThinking, forceSearch, scrollUserMsgToTop],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    clearMutation.mutate();
    useWorkspaceStore.getState().clearHighlights();
  };

  // Collect all sources from all assistant messages for citation fallback.
  // When the model doesn't call search_documents but references citation IDs
  // from earlier answers, this allows those citations to still render as links.
  // NOTE: Must be declared before any early returns to satisfy Rules of Hooks.
  const allSources = useMemo(() => {
    const seen = new Set<string>();
    const merged: ChatSourceChunk[] = [];
    for (const m of messages) {
      if (m.role === "assistant" && m.sources) {
        for (const s of m.sources) {
          const key = String(s.index);
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(s);
          }
        }
      }
    }
    return merged;
  }, [messages]);

  if (historyLoading) {
    return (
      <div className="h-full flex items-center justify-center border-r">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasIndexedDocs) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-4 border-r">
        <Bot className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground text-center">
          Index some documents to start chatting
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">
          Upload and process documents in the data panel
        </p>
      </div>
    );
  }

  return (
    <WsIdCtx.Provider value={workspaceId}>
      <DebugCtx.Provider value={debugMode}>
        <AllSourcesCtx.Provider value={allSources}>
          <div className="h-full flex flex-col border-r min-h-0">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b bg-background/80 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold tracking-tight">{t("chat.aiAssistant")}</span>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                      Online
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Thinking toggle — only visible when model supports thinking */}
                {thinkingSupported && (
                  <button
                    onClick={() => setEnableThinking((prev) => !prev)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                      enableThinking
                        ? "text-violet-500 bg-violet-500/10 hover:bg-violet-500/20 shadow-sm shadow-violet-500/10"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    title={enableThinking ? t("chat.thinkingOn") : t("chat.thinkingOff")}
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span className="uppercase tracking-tight">{t("chat.think")}</span>
                  </button>
                )}
                {/* Force search toggle */}
                <button
                  onClick={() => setForceSearch((prev) => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                    forceSearch
                      ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 shadow-sm shadow-amber-500/10"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  title={forceSearch ? t("chat.forceSearchOn") : t("chat.forceSearchOff")}
                >
                  <DatabaseZap className="w-3.5 h-3.5" />
                  <span className="uppercase tracking-tight">{t("chat.search")}</span>
                </button>
                <div className="h-4 w-px bg-border mx-1" />
                {/* System prompt settings */}
                <button
                  onClick={() => setShowPromptEditor((p) => !p)}
                  className={cn(
                    "p-1.5 rounded-lg transition-all",
                    showPromptEditor
                      ? "text-blue-500 bg-blue-500/10 hover:bg-blue-500/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  title={t("chat.systemPromptSettings")}
                >
                  <Settings className="w-4 h-4" />
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={handleClear}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-all text-muted-foreground"
                    title={t("chat.clearChat")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                {debugMode && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500 text-white font-bold tracking-widest shadow-sm">
                    DEBUG
                  </span>
                )}
              </div>
            </div>

            {/* System Prompt Editor */}
            <AnimatePresence>
              {showPromptEditor && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="shrink-0 overflow-visible border-b relative z-10"
                >
                  <div className="px-3 py-2 space-y-2 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        {t("chat.systemPrompt")}
                      </span>
                      <span
                        className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                          isCustom
                            ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                            : "bg-muted text-muted-foreground/50",
                        )}
                      >
                        {isCustom ? "Custom" : "Default"}
                      </span>
                    </div>
                    <textarea
                      value={promptDraft}
                      onChange={(e) => setPromptDraft(e.target.value)}
                      placeholder={t("chat.systemPromptPlaceholder")}
                      rows={8}
                      className={cn(
                        "w-full resize-none rounded-md border border-input bg-background px-2.5 py-2 text-xs",
                        "placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        "leading-relaxed",
                      )}
                    />
                    <div className="flex items-center gap-1.5">
                      <div className="relative group/cite">
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 cursor-help transition-all hover:bg-blue-500/20 hover:border-blue-500/30 shadow-sm shadow-blue-500/5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-bold uppercase tracking-tight">
                            {t("chat.hardRules")}
                          </span>
                        </div>

                        {/* Tooltip on hover — below icon */}
                        <div className="absolute left-0 top-full mt-2.5 z-50 w-[380px] rounded-xl border border-blue-500/20 bg-background/95 backdrop-blur-xl shadow-2xl opacity-0 pointer-events-none group-hover/cite:opacity-100 group-hover/cite:pointer-events-auto transition-all duration-300 translate-y-1 group-hover/cite:translate-y-0">
                          <div className="p-4 relative overflow-hidden">
                            {/* Background accent */}

                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 rounded-lg bg-blue-500/10">
                                <FileText className="w-4 h-4 text-blue-500" />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-foreground">
                                  AI Governance Rules
                                </h4>
                                <p className="text-[9px] text-muted-foreground font-medium">
                                  Strictly enforced for all workspace responses
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <div>
                                  <h5 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Languages className="w-3 h-3" /> Language
                                  </h5>
                                  <ul className="space-y-1.5">
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      Same language as question
                                    </li>
                                  </ul>
                                </div>
                                <div>
                                  <h5 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Hash className="w-3 h-3" /> Citation
                                  </h5>
                                  <ul className="space-y-1.5">
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      Cite EVERY claim: [id]
                                    </li>
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      Images: [IMG-id]
                                    </li>
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      Max 3 citations/sentence
                                    </li>
                                  </ul>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <h5 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Layout className="w-3 h-3" /> Formatting
                                  </h5>
                                  <ul className="space-y-1.5">
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      Start with direct summary
                                    </li>
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      Use tables & flat lists
                                    </li>
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      LaTeX for math symbols
                                    </li>
                                  </ul>
                                </div>
                                <div>
                                  <h5 className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                    <Ban className="w-3 h-3" /> Restrictions
                                  </h5>
                                  <ul className="space-y-1.5">
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      No hedging or emojis
                                    </li>
                                    <li className="text-[10px] text-foreground/80 leading-relaxed flex gap-1.5">
                                      <span className="text-blue-500 shrink-0">•</span>
                                      No trailing questions
                                    </li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={handleResetPrompt}
                        disabled={!isCustom && !promptIsDirty}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded text-[10px] transition-colors",
                          isCustom || promptIsDirty
                            ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                            : "text-muted-foreground/30 cursor-not-allowed",
                        )}
                        title={t("chat.resetPrompt")}
                      >
                        <RotateCcw className="w-3 h-3" />
                        {t("common.reset")}
                      </button>
                      <button
                        onClick={handleSavePrompt}
                        disabled={!promptIsDirty || updateWorkspaceMutation.isPending}
                        className={cn(
                          "flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-colors",
                          promptIsDirty && !updateWorkspaceMutation.isPending
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-muted text-muted-foreground/50 cursor-not-allowed",
                        )}
                      >
                        {updateWorkspaceMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Save className="w-3 h-3" />
                        )}
                        {t("common.save")}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages area */}
            {messages.length === 0 ? (
              <SuggestionChips onSelect={handleSend} />
            ) : (
              <div
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 relative"
              >
                <AnimatePresence>
                  {messages.map((msg) => (
                    <div key={msg.id} data-message-id={msg.id}>
                      <MessageBubble message={msg} />
                    </div>
                  ))}
                </AnimatePresence>
                {/* ThinkingTimeline + TypingIndicator now rendered inside MessageBubble */}
                {/* Bottom spacer = container height, enables user-message scroll-to-top */}
                <div ref={spacerRef} aria-hidden />

                {/* Scroll to Bottom Button */}
                <AnimatePresence>
                  {showScrollButton && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: 10 }}
                      onClick={() => scrollToBottom(true)}
                      className="absolute bottom-4 right-6 w-8 h-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors z-30"
                      title={t("chat.scrollToBottom")}
                    >
                      <ChevronDown className="w-5 h-5" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Input area */}
            <div className="shrink-0 px-4 pb-4 pt-0 border-t bg-background/80 backdrop-blur-md relative group/input flex flex-col">
              {/* Internal Resize Handle */}
              <div
                className="w-full h-1.5 cursor-ns-resize flex items-center justify-center hover:bg-primary/5 transition-colors group/handle py-2"
                onMouseDown={(e) => {
                  const startY = e.clientY;
                  const startHeight = inputRef.current?.offsetHeight || 0;
                  const onMouseMove = (moveEvent: MouseEvent) => {
                    if (inputRef.current) {
                      const delta = startY - moveEvent.clientY;
                      const newHeight = Math.max(36, Math.min(600, startHeight + delta));
                      inputRef.current.style.height = `${newHeight}px`;
                    }
                  };
                  const onMouseUp = () => {
                    window.removeEventListener("mousemove", onMouseMove);
                    window.removeEventListener("mouseup", onMouseUp);
                  };
                  window.addEventListener("mousemove", onMouseMove);
                  window.addEventListener("mouseup", onMouseUp);
                }}
              >
                <div className="w-8 h-1 rounded-full bg-muted-foreground/10 group-hover/handle:bg-primary/30 transition-all group-hover/handle:w-12" />
              </div>

              <div className="flex items-end gap-2 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("chat.inputPlaceholder")}
                  rows={1}
                  className={cn(
                    "flex-1 resize-none rounded-2xl border border-input bg-muted/30 px-4 py-2.5 text-sm",
                    "placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30",
                    "max-h-[600px] min-h-[44px] overflow-y-auto transition-all",
                    "focus:bg-background shadow-inner",
                  )}
                  style={{
                    height: "auto",
                    minHeight: "44px",
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = Math.min(target.scrollHeight, 600) + "px";
                  }}
                />
                <div className="flex flex-col gap-1">
                  {stream.isStreaming ? (
                    <button
                      onClick={stream.cancel}
                      className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-destructive/10 text-destructive hover:bg-destructive/20 shadow-sm"
                      title={t("chat.stopGenerating")}
                    >
                      <Square className="w-4 h-4 fill-current" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim()}
                      className={cn(
                        "shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md",
                        input.trim()
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-primary/20 hover:-translate-y-0.5"
                          : "bg-muted text-muted-foreground cursor-not-allowed",
                      )}
                    >
                      <Send
                        className={cn(
                          "w-4 h-4",
                          input.trim() && "animate-in fade-in zoom-in duration-300",
                        )}
                      />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[9px] text-muted-foreground/50 mt-1 text-center">
                {t("chat.inputHint")}
              </p>
            </div>
          </div>
        </AllSourcesCtx.Provider>
      </DebugCtx.Provider>
    </WsIdCtx.Provider>
  );
});
