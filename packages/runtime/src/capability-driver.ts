import type {
  VOPAction,
  VOPActionExecutionContext,
  VOPActionExecutionResult,
  VOPComponentAdapter,
} from "./runtime-types";
import type { VOPCapabilityBinding } from "./capability-bindings";

export class CapabilityBindingDriver implements VOPComponentAdapter {
  readonly id: string;

  readonly componentId: string;

  readonly supportedActions;

  constructor(private readonly binding: VOPCapabilityBinding) {
    this.id = `binding-driver-${binding.capabilityId}`;
    this.componentId = binding.capabilityId;
    this.supportedActions = binding.supportedActions;
  }

  execute(action: VOPAction, context: VOPActionExecutionContext): Promise<VOPActionExecutionResult> {
    return this.binding.execute(action, context);
  }

  getObservation() {
    return this.binding.observe?.() ?? {};
  }
}
