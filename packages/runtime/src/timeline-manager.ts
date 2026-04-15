import type { VOPAction, VOPTimelineEntry, VOPTimelineStatus } from "./runtime-types";
import { createId, nowIso } from "./utils";

export class TimelineManager {
  private entries: VOPTimelineEntry[] = [];

  startAction(taskId: string, action: VOPAction) {
    const entry: VOPTimelineEntry = {
      id: createId("timeline"),
      taskId,
      actionId: action.id,
      actionType: action.type,
      title: action.label,
      status: "running",
      message: `Executing: ${action.label}`,
      timestamp: nowIso(),
    };

    this.entries = [...this.entries, entry];
    return entry.id;
  }

  completeEntry(
    entryId: string,
    status: VOPTimelineStatus,
    message: string,
    confirmationId?: string,
  ) {
    this.entries = this.entries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            status,
            message,
            confirmationId,
          }
        : entry,
    );
  }

  getEntries() {
    return this.entries;
  }

  clear() {
    this.entries = [];
  }
}
