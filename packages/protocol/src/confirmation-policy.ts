export type VOPRiskLevel = "low" | "high";

export interface VOPConfirmationPolicy {
  mode: "none" | "required";
  title?: string;
  message?: string;
}
