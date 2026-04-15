import type {
  VOPAction,
  VOPActionExecutionResult,
  VOPComponentDescriptor,
  VOPComponentAdapter,
  VOPRuntimeController,
  VOPRuntimeSnapshot,
  VOPTask,
  VOPTaskDefinition,
} from "./runtime-types";
import type { VOPAppManifest } from "@futelab/vop-internal-protocol";
import { ActionExecutor } from "./action-executor";
import { AuditLogger } from "./audit-logger";
import { ComponentRegistry } from "./component-registry";
import { ConfirmationManager } from "./confirmation-manager";
import { HighlightManager } from "./highlight-manager";
import { ObservationBuilder } from "./observation-builder";
import { TaskManager } from "./task-manager";
import { TimelineManager } from "./timeline-manager";

export class VOPRuntime implements VOPRuntimeController {
  private appManifest: VOPAppManifest | null = null;

  private readonly registry = new ComponentRegistry();

  private readonly taskManager = new TaskManager();

  private readonly timelineManager = new TimelineManager();

  private readonly highlightManager = new HighlightManager();

  private readonly confirmationManager = new ConfirmationManager();

  private readonly auditLogger = new AuditLogger();

  private readonly observationBuilder = new ObservationBuilder(this.registry);

  private readonly actionExecutor = new ActionExecutor(this.registry);

  private readonly listeners = new Set<() => void>();

  private snapshot: VOPRuntimeSnapshot;

  constructor() {
    this.snapshot = this.createSnapshot();
  }

  registerAppManifest(manifest: VOPAppManifest) {
    this.appManifest = manifest;
    this.emit();
  }

  registerComponent(descriptor: VOPComponentDescriptor) {
    this.registry.registerComponent(descriptor);
    this.emit();
  }

  registerAdapter(adapter: VOPComponentAdapter) {
    this.registry.registerAdapter(adapter);
    this.emit();
  }

  async startTask(definition: VOPTaskDefinition) {
    this.assertPageExists(definition.pageId);
    this.timelineManager.clear();
    this.highlightManager.clear();
    this.confirmationManager.clear();

    const actions = definition.actions.map((action) => ({ ...action, status: "pending" as const }));
    const task = this.taskManager.createTask(definition.pageId, definition.intent, actions);
    this.auditLogger.log("task_started", {
      taskId: task.id,
      intent: definition.intent.text,
      pageId: definition.pageId,
    });
    this.emit();
    return task;
  }

  async dispatchAction(action: VOPAction) {
    const task = this.taskManager.getTask();
    if (!task) {
      throw new Error("Task is not initialized.");
    }

    if (!task.actions.find((candidate) => candidate.id === action.id)) {
      this.taskManager.appendAction(action);
    }

    return this.runAction(task, action);
  }

  async confirmPendingAction() {
    const task = this.taskManager.getTask();
    const pending = this.confirmationManager.getPending();

    if (!task || !pending) {
      return;
    }

    const action = this.taskManager.createSystemAction(
      "confirm_action",
      pending.componentId,
      "Confirm destructive action",
      pending.id,
    );

    await this.dispatchAction(action);
  }

  async cancelPendingAction() {
    const task = this.taskManager.getTask();
    const pending = this.confirmationManager.getPending();

    if (!task || !pending) {
      return;
    }

    const action = this.taskManager.createSystemAction(
      "cancel_action",
      pending.componentId,
      "Cancel destructive action",
      pending.id,
    );

    await this.dispatchAction(action);
  }

  resetSession() {
    this.taskManager.clear();
    this.timelineManager.clear();
    this.highlightManager.clear();
    this.confirmationManager.clear();
    this.emit();
  }

  getState(): VOPRuntimeSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.snapshot = this.createSnapshot();
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  private createSnapshot(): VOPRuntimeSnapshot {
    return {
      appManifest: this.appManifest,
      task: this.taskManager.getTask(),
      pendingConfirmation: this.confirmationManager.getPending(),
      timeline: this.timelineManager.getEntries(),
      auditLogs: this.auditLogger.getEntries(),
      highlightedComponentId: this.highlightManager.getHighlightedComponentId(),
      components: this.registry.listComponents(),
    };
  }

  private async runAction(task: VOPTask, action: VOPAction): Promise<VOPActionExecutionResult> {
    this.assertActionAllowed(task, action);
    const entryId = this.timelineManager.startAction(task.id, action);
    this.taskManager.setCurrentAction(action.id);
    this.taskManager.setStatus("running");
    this.taskManager.markActionStatus(action.id, "running");
    this.highlightManager.focus(action.componentId);
    this.auditLogger.log("action_started", {
      taskId: task.id,
      actionId: action.id,
      actionType: action.type,
      componentId: action.componentId,
    });
    this.emit();

    try {
      const result = await this.actionExecutor.execute(
        task,
        action,
        this.confirmationManager.getPending(),
      );

      if (result.highlightComponentId) {
        this.highlightManager.focus(result.highlightComponentId);
      }

      if (result.status === "waiting_confirmation" && result.confirmation) {
        const confirmation = this.confirmationManager.open(
          task,
          action,
          result.highlightComponentId ?? action.componentId,
          result.confirmation,
        );
        this.taskManager.markActionStatus(action.id, "awaiting_confirmation");
        this.taskManager.setPendingConfirmation(confirmation.id);
        this.taskManager.setStatus("awaiting_confirmation");
        this.timelineManager.completeEntry(
          entryId,
          "awaiting_confirmation",
          result.summary,
          confirmation.id,
        );
        this.auditLogger.log("confirmation_requested", {
          taskId: task.id,
          confirmationId: confirmation.id,
          sourceActionId: action.id,
          payload: confirmation.payload,
        });
      } else {
        this.handleResolvedAction(action, result.summary);
        this.timelineManager.completeEntry(entryId, "succeeded", result.summary);
      }

      const updatedTask = this.taskManager.getTask();
      if (updatedTask) {
        const observation = this.observationBuilder.build(
          updatedTask,
          action.id,
          result.summary,
          this.confirmationManager.getPending(),
        );
        this.taskManager.setObservation(observation);
        this.auditLogger.log("observation_recorded", {
          taskId: updatedTask.id,
          observationId: observation.id,
          actionId: action.id,
          summary: observation.summary,
        });
      }

      this.emit();
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown runtime error.";
      this.taskManager.markActionStatus(action.id, "failed");
      this.taskManager.failTask(message);
      this.highlightManager.clear();
      this.timelineManager.completeEntry(entryId, "failed", message);
      this.auditLogger.log("task_failed", {
        taskId: task.id,
        actionId: action.id,
        message,
      });
      this.emit();
      throw error;
    }
  }

  private handleResolvedAction(action: VOPAction, summary: string) {
    if (action.type === "navigate") {
      this.taskManager.setPageId(action.payload.targetPageId);
    }

    if (action.type === "confirm_action") {
      const resolved = this.confirmationManager.confirmPending();
      this.taskManager.resolveConfirmationSource(resolved.sourceActionId, "succeeded");
      this.taskManager.markActionStatus(action.id, "succeeded");
      this.taskManager.setPendingConfirmation(undefined);
      this.auditLogger.log("confirmation_resolved", {
        confirmationId: resolved.id,
        status: resolved.status,
      });

      if (this.taskManager.allActionsResolved()) {
        this.taskManager.completeTask();
        this.highlightManager.clear();
        const task = this.taskManager.getTask();
        if (task) {
          this.auditLogger.log("task_completed", {
            taskId: task.id,
            summary,
          });
        }
      }

      return;
    }

    if (action.type === "cancel_action") {
      const resolved = this.confirmationManager.cancelPending();
      this.taskManager.resolveConfirmationSource(resolved.sourceActionId, "cancelled");
      this.taskManager.markActionStatus(action.id, "succeeded");
      this.taskManager.setPendingConfirmation(undefined);
      this.taskManager.cancelTask("The destructive action was cancelled by the user.");
      this.highlightManager.clear();
      const task = this.taskManager.getTask();
      if (task) {
        this.auditLogger.log("confirmation_resolved", {
          confirmationId: resolved.id,
          status: resolved.status,
        });
        this.auditLogger.log("task_cancelled", {
          taskId: task.id,
          reason: task.error,
        });
      }
      return;
    }

    this.taskManager.markActionStatus(action.id, "succeeded");
    if (this.taskManager.allActionsResolved()) {
      this.taskManager.completeTask();
      this.highlightManager.clear();
      const task = this.taskManager.getTask();
      if (task) {
        this.auditLogger.log("task_completed", {
          taskId: task.id,
          summary,
        });
      }
    }
  }

  private assertPageExists(pageId: string) {
    if (!this.appManifest) {
      return;
    }

    const exists = this.appManifest.pages.some((page) => page.pageId === pageId);
    if (!exists) {
      throw new Error(`Page ${pageId} is not declared in the registered app manifest.`);
    }
  }

  private assertActionAllowed(task: VOPTask, action: VOPAction) {
    if (action.type !== "navigate") {
      return;
    }

    this.assertPageExists(action.payload.targetPageId);

    if (!this.appManifest) {
      return;
    }

    const canNavigate = this.appManifest.navigation.some((rule) => {
      if (rule.toPageId !== action.payload.targetPageId) {
        return false;
      }

      if (!rule.fromPageId) {
        return true;
      }

      return rule.fromPageId === task.pageId;
    });

    if (!canNavigate) {
      throw new Error(
        `Navigation from ${task.pageId} to ${action.payload.targetPageId} is not allowed by the app manifest.`,
      );
    }
  }
}
