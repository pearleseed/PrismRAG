import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ChatHistoryResponse } from "@/types";

export function useChatHistory(workspaceId: string, conversationId?: number | null) {
  return useQuery({
    queryKey: ["chat-history", workspaceId, conversationId],
    queryFn: () => {
      const url = conversationId
        ? `/rag/chat/${workspaceId}/history?conversation_id=${conversationId}`
        : `/rag/chat/${workspaceId}/history`;
      return api.get<ChatHistoryResponse>(url);
    },
    enabled: !!workspaceId,
    staleTime: Infinity,
  });
}

export function useClearChatHistory(workspaceId: string, conversationId?: number | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      const url = conversationId
        ? `/rag/chat/${workspaceId}/history?conversation_id=${conversationId}`
        : `/rag/chat/${workspaceId}/history`;
      return api.delete(url);
    },
    onSuccess: () => {
      queryClient.setQueryData<ChatHistoryResponse>(
        ["chat-history", workspaceId, conversationId],
        {
          workspace_id: Number(workspaceId),
          conversation_id: conversationId ?? null,
          messages: [],
          total: 0,
        }
      );
    },
  });
}
