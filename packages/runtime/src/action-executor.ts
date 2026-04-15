import type {
  VOPAction,
  VOPActionExecutionResult,
  VOPConfirmation,
  VOPTask,
} from "./runtime-types";
import { ComponentRegistry } from "./component-registry";

export class ActionExecutor {
  constructor(private readonly registry: ComponentRegistry) {}

  async execute(
    task: VOPTask,
    action: VOPAction,
    confirmation: VOPConfirmation | null,
  ): Promise<VOPActionExecutionResult> {
    const adapter = this.registry.getAdapter(action.componentId, action.type);
    if (!adapter) {
      throw new Error(
        `No adapter registered for component ${action.componentId} and action ${action.type}.`,
      );
    }

    return adapter.execute(action, {
      task,
      action,
      confirmation,
    });
  }
}
