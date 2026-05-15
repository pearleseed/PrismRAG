import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Conversation } from "../types";
import { api } from "@/lib/api";

export function useConversations(workspaceId: number | undefined) {
  return useQuery<Conversation[]>({
    queryKey: ["conversations", workspaceId],
    queryFn: async () => {
      return api.get<Conversation[]>(`/rag/chat/${workspaceId}/conversations`);
    },
    enabled: !!workspaceId,
  });
}

export function useCreateConversation(workspaceId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string = "New Conversation") => {
      return api.post<Conversation>(`/rag/chat/${workspaceId}/conversations`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
    },
  });
}

export function useUpdateConversation(workspaceId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      return api.patch<Conversation>(`/rag/chat/${workspaceId}/conversations/${id}`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
    },
  });
}

export function useDeleteConversation(workspaceId: number | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      return api.delete(`/rag/chat/${workspaceId}/conversations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations", workspaceId] });
    },
  });
}
