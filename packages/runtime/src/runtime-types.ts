import type {
  VOPActionType,
  VOPAppManifest,
  VOPCapabilityKind,
  VOPRiskLevel,
} from "@futelab/vop-internal-protocol";

export type VOPTaskStatus =
  | "idle"
  | "running"
  | "awaiting_confirmation"
  | "completed"
  | "cancelled"
  | "failed";

export type VOPActionStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "awaiting_confirmation"
  | "cancelled"
  | "failed";

export type VOPTimelineStatus =
  | "running"
  | "succeeded"
  | "awaiting_confirmation"
  | "cancelled"
  | "failed";

export interface VOPIntent {
  id: string;
  text: string;
}

export interface VOPActionBase<TType extends VOPActionType, TPayload> {
  id: string;
  type: TType;
  componentId: string;
  label: string;
  risk: VOPRiskLevel;
  status: VOPActionStatus;
  payload: TPayload;
}

export interface NavigateAction
  extends VOPActionBase<"navigate", { targetPageId: string }> {}

export interface SetFilterAction
  extends VOPActionBase<
    "set_filter",
    Record<string, unknown>
  > {}

export interface ClearFilterAction
  extends VOPActionBase<"clear_filter", Record<string, unknown>> {}

export interface RunSearchAction
  extends VOPActionBase<"run_search", Record<string, never>> {}

export interface SelectRowsAction
  extends VOPActionBase<
    "select_rows",
    {
      strategy: string;
      rowIds?: string[];
    }
  > {}

export interface ClearSelectionAction
  extends VOPActionBase<"clear_selection", Record<string, never>> {}

export interface InvokeRowAction
  extends VOPActionBase<
    "invoke_row_action",
    {
      rowId: string;
      actionId: string;
    }
  > {}

export interface InvokeBulkAction
  extends VOPActionBase<
    "invoke_bulk_action",
    {
      actionId: string;
    }
  > {}

export interface ConfirmAction
  extends VOPActionBase<
    "confirm_action",
    {
      confirmationId: string;
    }
  > {}

export interface CancelAction
  extends VOPActionBase<
    "cancel_action",
    {
      confirmationId: string;
    }
  > {}

export type VOPAction =
  | NavigateAction
  | SetFilterAction
  | ClearFilterAction
  | RunSearchAction
  | SelectRowsAction
  | ClearSelectionAction
  | InvokeRowAction
  | InvokeBulkAction
  | ConfirmAction
  | CancelAction;

export interface VOPConfirmation {
  id: string;
  taskId: string;
  sourceActionId: string;
  componentId: string;
  status: "pending" | "confirmed" | "cancelled";
  title: string;
  message: string;
  risk: "high";
  payload: {
    actionId: string;
    selectedIds: string[];
    count: number;
  };
  createdAt: string;
  resolvedAt?: string;
}

export interface VOPObservation {
  id: string;
  taskId: string;
  actionId: string;
  pageId: string;
  timestamp: string;
  summary: string;
  canContinue: boolean;
  pendingConfirmationId?: string;
  components: Record<string, unknown>;
}

export interface VOPTask {
  id: string;
  pageId: string;
  intent: VOPIntent;
  status: VOPTaskStatus;
  actions: VOPAction[];
  currentActionId?: string;
  pendingConfirmationId?: string;
  lastObservation?: VOPObservation;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface VOPTimelineEntry {
  id: string;
  taskId: string;
  actionId: string;
  actionType: VOPActionType;
  title: string;
  status: VOPTimelineStatus;
  message: string;
  timestamp: string;
  confirmationId?: string;
}

export interface VOPAuditEntry {
  id: string;
  kind:
    | "task_started"
    | "action_started"
    | "observation_recorded"
    | "confirmation_requested"
    | "confirmation_resolved"
    | "task_completed"
    | "task_cancelled"
    | "task_failed";
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface VOPComponentDescriptor {
  id: string;
  pageId: string;
  capabilityKind: VOPCapabilityKind;
  label: string;
  getElement?: () => HTMLElement | null;
}

export interface VOPConfirmationDraft {
  title: string;
  message: string;
  payload: {
    actionId: string;
    selectedIds: string[];
    count: number;
  };
}

export interface VOPActionExecutionContext {
  task: VOPTask;
  action: VOPAction;
  confirmation: VOPConfirmation | null;
}

export interface VOPActionExecutionResult {
  status: "success" | "waiting_confirmation";
  summary: string;
  highlightComponentId?: string;
  confirmation?: VOPConfirmationDraft;
  data?: Record<string, unknown>;
}

export interface VOPComponentAdapter {
  id: string;
  componentId: string;
  supportedActions: readonly VOPActionType[];
  execute(
    action: VOPAction,
    context: VOPActionExecutionContext,
  ): Promise<VOPActionExecutionResult>;
  getObservation?(): object;
}

export interface VOPTaskDefinition {
  pageId: string;
  intent: VOPIntent;
  actions: VOPAction[];
}

export interface VOPRuntimeSnapshot {
  appManifest: VOPAppManifest | null;
  task: VOPTask | null;
  pendingConfirmation: VOPConfirmation | null;
  timeline: VOPTimelineEntry[];
  auditLogs: VOPAuditEntry[];
  highlightedComponentId: string | null;
  components: VOPComponentDescriptor[];
}

export interface VOPRuntimeController {
  registerAppManifest(manifest: VOPAppManifest): void;
  registerComponent(descriptor: VOPComponentDescriptor): void;
  registerAdapter(adapter: VOPComponentAdapter): void;
  startTask(definition: VOPTaskDefinition): Promise<VOPTask>;
  dispatchAction(action: VOPAction): Promise<VOPActionExecutionResult>;
  confirmPendingAction(): Promise<void>;
  cancelPendingAction(): Promise<void>;
  resetSession(): void;
  getState(): VOPRuntimeSnapshot;
  subscribe(listener: () => void): () => void;
}
