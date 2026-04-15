import type {
  VOPAction,
  VOPConfirmation,
  VOPConfirmationDraft,
  VOPTask,
} from "./runtime-types";
import { createId, nowIso } from "./utils";

export class ConfirmationManager {
  private pending: VOPConfirmation | null = null;

  open(
    task: VOPTask,
    action: VOPAction,
    componentId: string,
    draft: VOPConfirmationDraft,
  ) {
    this.pending = {
      id: createId("confirmation"),
      taskId: task.id,
      sourceActionId: action.id,
      componentId,
      status: "pending",
      title: draft.title,
      message: draft.message,
      risk: "high",
      payload: draft.payload,
      createdAt: nowIso(),
    };

    return this.pending;
  }

  getPending() {
    return this.pending;
  }

  confirmPending() {
    if (!this.pending) {
      throw new Error("No pending confirmation.");
    }

    const resolved = {
      ...this.pending,
      status: "confirmed" as const,
      resolvedAt: nowIso(),
    };

    this.pending = null;
    return resolved;
  }

  cancelPending() {
    if (!this.pending) {
      throw new Error("No pending confirmation.");
    }

    const resolved = {
      ...this.pending,
      status: "cancelled" as const,
      resolvedAt: nowIso(),
    };

    this.pending = null;
    return resolved;
  }

  clear() {
    this.pending = null;
  }
}
