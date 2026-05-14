import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import axios from "axios";

function axiosErrorDetail(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail?: unknown }).detail)
        : undefined;
    return detail || error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

// Constants
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8080/api/v1";

// Server Setup
const server = new McpServer({
  name: "prismrag-mcp-server",
  version: "1.0.0",
});

// Tools Registration
server.registerTool(
  "get_workspace_list",
  {
    description:
      "Retrieve a complete list of all active workspaces (knowledge bases) available in PrismRAG. Use this to find the correct `workspace_id` needed for querying documents or understanding the available context domains.",
  },
  async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/workspaces`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch workspaces: ${axiosErrorDetail(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "get_document_markdown",
  {
    description:
      "Retrieve the full structured markdown content of a specific document (parsed by PrismRAG). This includes text content, table representations, and image placeholders.",
    inputSchema: {
      document_id: z.number().describe("The ID of the document to retrieve markdown for."),
    },
  },
  async ({ document_id }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/${document_id}/markdown`);
      return {
        content: [
          {
            type: "text",
            text: response.data,
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch document markdown for ${document_id}: ${axiosErrorDetail(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "get_document_metadata",
  {
    description:
      "Fetch the full metadata and processing state of a specific document using its unique `document_id`. Use this when you need to know a document's status, filename, source, or parsing results (like chunk/image counts).",
    inputSchema: {
      document_id: z.number().describe("The ID of the document to retrieve metadata for."),
    },
  },
  async ({ document_id }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/${document_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch document metadata for ${document_id}: ${axiosErrorDetail(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "list_documents",
  {
    description:
      "List all documents currently stored in a specific knowledge base (workspace). Use this to browse available files and find specific `document_id`s.",
    inputSchema: {
      workspace_id: z.number().describe("The ID of the workspace to list documents from."),
    },
  },
  async ({ workspace_id }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/documents/workspace/${workspace_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to list documents for workspace ${workspace_id}: ${axiosErrorDetail(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "query",
  {
    description:
      "Perform a semantic or hybrid search against the Vector Database for a given `workspace_id`. Use this tool to reliably find relevant context or exact answers to user questions from the indexed knowledge base.",
    inputSchema: {
      workspace_id: z
        .number()
        .describe("The ID of the workspace to query. (Find this using get_workspace_list)"),
      question: z.string().describe("The search query or question to send to the vector database."),
      top_k: z
        .number()
        .optional()
        .describe(
          "Number of context chunks to retrieve (default: 5). Increase this if more context is needed.",
        ),
      mode: z
        .string()
        .optional()
        .describe(
          "Search mode: 'hybrid' (default, recommended), 'vector_only', 'naive', 'local', 'global'",
        ),
    },
  },
  async ({ workspace_id, question, top_k = 5, mode = "hybrid" }) => {
    try {
      const payload = {
        question,
        top_k,
        mode,
      };
      const response = await axios.post(`${API_BASE_URL}/rag/query/${workspace_id}`, payload);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Query failed for workspace ${workspace_id}: ${axiosErrorDetail(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "get_chunks",
  {
    description:
      "Retrieve the raw text chunks that were extracted from a specific document during ingestion. Use this when you have a `document_id` and need to read the actual extracted text contents of that document in manageable sequences.",
    inputSchema: {
      document_id: z.number().describe("The ID of the document to get chunks for."),
    },
  },
  async ({ document_id }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/rag/chunks/${document_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch chunks for document ${document_id}: ${axiosErrorDetail(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "get_kg_graph",
  {
    description:
      "Export knowledge graph data (entities and relationships) for a specific workspace. Useful for understanding complex connections between concepts in the knowledge base.",
    inputSchema: {
      workspace_id: z.number().describe("The ID of the workspace to get graph data for."),
      center: z.string().optional().describe("Entity name to center the graph on."),
      max_depth: z
        .number()
        .optional()
        .describe("Maximum depth of relationships to traverse (default: 3)."),
      max_nodes: z
        .number()
        .optional()
        .describe("Maximum number of nodes to return (default: 150)."),
    },
  },
  async ({ workspace_id, center, max_depth = 3, max_nodes = 150 }) => {
    try {
      const params = new URLSearchParams();
      if (center) params.append("center", center);
      params.append("max_depth", String(max_depth));
      params.append("max_nodes", String(max_nodes));

      const response = await axios.get(
        `${API_BASE_URL}/rag/graph/${workspace_id}?${params.toString()}`,
      );
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch KG graph for workspace ${workspace_id}: ${axiosErrorDetail(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

server.registerTool(
  "get_workspace_stats",
  {
    description:
      "Retrieve high-level statistics for a knowledge base, including document count, chunk count, and image count.",
    inputSchema: {
      workspace_id: z.number().describe("The ID of the workspace to get stats for."),
    },
  },
  async ({ workspace_id }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/rag/stats/${workspace_id}`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch stats for workspace ${workspace_id}: ${axiosErrorDetail(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Run Server
async function main() {
  const transportType = process.env.TRANSPORT === "http" ? "http" : "stdio";

  if (transportType === "http") {
    const app = createMcpExpressApp();
    const port = process.env.PORT || 8000;

    // Store active transports
    const transports: Record<string, StreamableHTTPServerTransport> = {};

    // Single endpoint /mcp handles GET, POST, DELETE requests
    app.all("/mcp", async (req: Request, res: Response) => {
      try {
        const sessionId = req.headers["mcp-session-id"] as string;
        let transport: StreamableHTTPServerTransport | undefined;

        if (sessionId && transports[sessionId]) {
          transport = transports[sessionId];
        } else if (!sessionId && req.method === "POST" && isInitializeRequest(req.body)) {
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSessionId) => {
              transports[newSessionId] = transport!;
            },
          });

          transport.onclose = () => {
            const sid = transport?.sessionId;
            if (sid && transports[sid]) {
              delete transports[sid];
            }
          };

          await server.connect(transport);
        } else {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: "Bad Request: No valid session ID and not an initialization request",
            },
            id: null,
          });
          return;
        }

        await transport.handleRequest(req, res, req.body);
      } catch (error: unknown) {
        console.error("MCP /mcp handler error:", error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error",
            },
            id: null,
          });
        }
      }
    });

    app.listen(port, () => {
      console.log(`PrismRAG MCP server running on Streamable HTTP at http://localhost:${port}/mcp`);
    });

    // Cleanup handlers
    process.on("SIGINT", async () => {
      for (const sid in transports) {
        await transports[sid].close();
      }
      process.exit(0);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("PrismRAG MCP server running on stdio");
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
