import type { VOPAction, VOPActionStatus, VOPObservation, VOPTask } from "./runtime-types";
import { createId, nowIso } from "./utils";

export class TaskManager {
  private currentTask: VOPTask | null = null;

  createTask(pageId: string, intent: VOPTask["intent"], actions: VOPAction[]) {
    this.currentTask = {
      id: createId("task"),
      pageId,
      intent,
      status: "running",
      actions,
      startedAt: nowIso(),
    };

    return this.currentTask;
  }

  getTask() {
    return this.currentTask;
  }

  clear() {
    this.currentTask = null;
  }

  appendAction(action: VOPAction) {
    if (!this.currentTask) {
      throw new Error("Task is not initialized.");
    }

    this.currentTask.actions.push(action);
  }

  setStatus(status: VOPTask["status"]) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.status = status;
  }

  setCurrentAction(actionId: string) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.currentActionId = actionId;
  }

  setPendingConfirmation(confirmationId?: string) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.pendingConfirmationId = confirmationId;
  }

  setPageId(pageId: string) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.pageId = pageId;
  }

  setObservation(observation: VOPObservation) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.lastObservation = observation;
  }

  setError(message: string) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.error = message;
  }

  markActionStatus(actionId: string, status: VOPActionStatus) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.actions = this.currentTask.actions.map((action) =>
      action.id === actionId ? { ...action, status } : action,
    );
  }

  resolveConfirmationSource(actionId: string, status: "succeeded" | "cancelled") {
    this.markActionStatus(actionId, status);
  }

  completeTask() {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.status = "completed";
    this.currentTask.completedAt = nowIso();
  }

  cancelTask(message: string) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.status = "cancelled";
    this.currentTask.error = message;
    this.currentTask.completedAt = nowIso();
  }

  failTask(message: string) {
    if (!this.currentTask) {
      return;
    }

    this.currentTask.status = "failed";
    this.currentTask.error = message;
    this.currentTask.completedAt = nowIso();
  }

  allActionsResolved() {
    if (!this.currentTask) {
      return false;
    }

    return this.currentTask.actions.every((action) =>
      ["succeeded", "cancelled", "failed"].includes(action.status),
    );
  }

  createSystemAction(
    type: "confirm_action" | "cancel_action",
    componentId: string,
    label: string,
    confirmationId: string,
  ) {
    return {
      id: createId("action"),
      type,
      componentId,
      label,
      risk: "high",
      status: "pending",
      payload: {
        confirmationId,
      },
    } as VOPAction;
  }
}
