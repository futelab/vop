import type { VOPTaskDefinition } from "@futelab/vop-internal-runtime";

export interface AssistantMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

export interface AssistantStep {
  key: string;
  title: string;
  description: string;
  status: "loading" | "success" | "error" | "abort";
}

export interface VopAssistantPlan {
  task: VOPTaskDefinition;
  conversationKey?: string;
}
