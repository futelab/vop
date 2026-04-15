export type VOPCapabilityKind =
  | "navigation"
  | "state"
  | "collection"
  | "mutation"
  | "confirmation";

export interface VOPCapabilityDescriptor {
  id: string;
  kind: VOPCapabilityKind;
  label: string;
}
