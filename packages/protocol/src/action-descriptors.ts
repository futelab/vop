import type { VOPConfirmationPolicy, VOPRiskLevel } from "./confirmation-policy";

export type VOPActionType =
  | "navigate"
  | "set_filter"
  | "clear_filter"
  | "run_search"
  | "select_rows"
  | "clear_selection"
  | "invoke_row_action"
  | "invoke_bulk_action"
  | "confirm_action"
  | "cancel_action";

export interface VOPActionDescriptor {
  id: string;
  componentId: string;
  type: VOPActionType;
  label: string;
  risk: VOPRiskLevel;
  confirmation: VOPConfirmationPolicy;
  payloadShape?: Record<string, string>;
}
