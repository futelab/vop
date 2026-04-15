import type {
  VOPConfirmation,
  VOPObservation,
  VOPTask,
} from "./runtime-types";
import { createId, nowIso } from "./utils";
import { ComponentRegistry } from "./component-registry";

export class ObservationBuilder {
  constructor(private readonly registry: ComponentRegistry) {}

  build(
    task: VOPTask,
    actionId: string,
    summary: string,
    pendingConfirmation: VOPConfirmation | null,
  ): VOPObservation {
    const components = this.registry.listAdapters().reduce<Record<string, unknown>>(
      (accumulator, adapter) => {
        accumulator[adapter.componentId] = adapter.getObservation?.() ?? {};
        return accumulator;
      },
      {},
    );

    return {
      id: createId("observation"),
      taskId: task.id,
      actionId,
      pageId: task.pageId,
      timestamp: nowIso(),
      summary,
      canContinue: !pendingConfirmation,
      pendingConfirmationId: pendingConfirmation?.id,
      components,
    };
  }
}
