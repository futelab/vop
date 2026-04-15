import type { VOPActionDescriptor, VOPPageManifest } from "@futelab/vop-internal-protocol";
import type { VOPAction, VOPTaskDefinition } from "./runtime-types";
import { createId } from "./utils";

export function createActionFromDescriptor<TPayload>(
  descriptor: VOPActionDescriptor,
  payload: TPayload,
): VOPAction {
  return {
    id: createId("action"),
    type: descriptor.type,
    componentId: descriptor.componentId,
    label: descriptor.label,
    risk: descriptor.risk,
    status: "pending",
    payload,
  } as VOPAction;
}

export function getActionDescriptor(manifest: VOPPageManifest, actionId: string) {
  const descriptor = manifest.actions.find((action) => action.id === actionId);
  if (!descriptor) {
    throw new Error(`Action descriptor ${actionId} is not defined for page ${manifest.pageId}.`);
  }

  return descriptor;
}

export function createTaskDefinition(
  pageId: string,
  intent: VOPTaskDefinition["intent"],
  actions: VOPAction[],
): VOPTaskDefinition {
  return {
    pageId,
    intent,
    actions,
  };
}
