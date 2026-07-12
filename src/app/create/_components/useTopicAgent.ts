"use client";

import { useAssistantAgent } from "@/hooks/useAssistantAgent";
import type { AgentMessage } from "@/types/agent-stream";
import type { TopicPatch } from "@/services/ai/topic-agent";

export type { AgentMessage };

interface UseTopicAgentOptions {
  topicId?: number;
  onPatch?: (patch: TopicPatch) => void;
}

export function useTopicAgent({ topicId, onPatch }: UseTopicAgentOptions) {
  return useAssistantAgent<TopicPatch>({
    endpoint: topicId ? `/api/create/topics/${topicId}/chat` : "/api/create/topics/chat",
    onPatch,
  });
}
