import type { VOPActionType, VOPPageManifest } from "@futelab/vop-internal-protocol";
import type {
  VOPAction,
  VOPActionExecutionContext,
  VOPActionExecutionResult,
  CancelAction,
  ClearFilterAction,
  ClearSelectionAction,
  ConfirmAction,
  VOPComponentDescriptor,
  InvokeBulkAction,
  InvokeRowAction,
  NavigateAction,
  RunSearchAction,
  SelectRowsAction,
  SetFilterAction,
  VOPRuntimeController,
} from "./runtime-types";
import { CapabilityBindingDriver } from "./capability-driver";

export interface VOPCapabilityBinding {
  capabilityId: string;
  getElement?: () => HTMLElement | null;
  supportedActions: readonly VOPActionType[];
  execute(
    action: VOPAction,
    context: VOPActionExecutionContext,
  ): Promise<VOPActionExecutionResult>;
  observe?: () => object;
}

interface BindingBase {
  capabilityId: string;
  getElement?: () => HTMLElement | null;
  observe?: () => object;
}

interface NavigationBindingConfig extends BindingBase {
  navigate: (action: NavigateAction) => Promise<VOPActionExecutionResult>;
}

interface StateBindingConfig extends BindingBase {
  setFilter: (action: SetFilterAction) => Promise<VOPActionExecutionResult>;
  clearFilter: (action: ClearFilterAction) => Promise<VOPActionExecutionResult>;
  runSearch: (action: RunSearchAction) => Promise<VOPActionExecutionResult>;
}

interface CollectionBindingConfig extends BindingBase {
  selectRows: (action: SelectRowsAction) => Promise<VOPActionExecutionResult>;
  clearSelection: (
    action: ClearSelectionAction,
  ) => Promise<VOPActionExecutionResult>;
  invokeRowAction: (
    action: InvokeRowAction,
  ) => Promise<VOPActionExecutionResult>;
  invokeBulkAction: (
    action: InvokeBulkAction,
  ) => Promise<VOPActionExecutionResult>;
}

interface ConfirmationBindingConfig extends BindingBase {
  confirmAction: (
    action: ConfirmAction,
    context: VOPActionExecutionContext,
  ) => Promise<VOPActionExecutionResult>;
  cancelAction: (
    action: CancelAction,
    context: VOPActionExecutionContext,
  ) => Promise<VOPActionExecutionResult>;
}

export interface VOPPageBindings {
  pageId: string;
  capabilities: VOPCapabilityBinding[];
}

export function createNavigationBinding(
  config: NavigationBindingConfig,
): VOPCapabilityBinding {
  return {
    capabilityId: config.capabilityId,
    getElement: config.getElement,
    supportedActions: ["navigate"],
    execute(action) {
      if (action.type !== "navigate") {
        throw new Error(`Unsupported navigation action: ${action.type}.`);
      }

      return config.navigate(action);
    },
    observe: config.observe,
  };
}

export function createStateBinding(config: StateBindingConfig): VOPCapabilityBinding {
  return {
    capabilityId: config.capabilityId,
    getElement: config.getElement,
    supportedActions: ["set_filter", "clear_filter", "run_search"],
    execute(action) {
      switch (action.type) {
        case "set_filter":
          return config.setFilter(action);
        case "clear_filter":
          return config.clearFilter(action);
        case "run_search":
          return config.runSearch(action);
        default:
          throw new Error(`Unsupported state action: ${action.type}.`);
      }
    },
    observe: config.observe,
  };
}

export function createCollectionBinding(
  config: CollectionBindingConfig,
): VOPCapabilityBinding {
  return {
    capabilityId: config.capabilityId,
    getElement: config.getElement,
    supportedActions: [
      "select_rows",
      "clear_selection",
      "invoke_row_action",
      "invoke_bulk_action",
    ],
    execute(action) {
      switch (action.type) {
        case "select_rows":
          return config.selectRows(action);
        case "clear_selection":
          return config.clearSelection(action);
        case "invoke_row_action":
          return config.invokeRowAction(action);
        case "invoke_bulk_action":
          return config.invokeBulkAction(action);
        default:
          throw new Error(`Unsupported collection action: ${action.type}.`);
      }
    },
    observe: config.observe,
  };
}

export function createConfirmationBinding(
  config: ConfirmationBindingConfig,
): VOPCapabilityBinding {
  return {
    capabilityId: config.capabilityId,
    getElement: config.getElement,
    supportedActions: ["confirm_action", "cancel_action"],
    execute(action, context) {
      switch (action.type) {
        case "confirm_action":
          return config.confirmAction(action, context);
        case "cancel_action":
          return config.cancelAction(action, context);
        default:
          throw new Error(`Unsupported confirmation action: ${action.type}.`);
      }
    },
    observe: config.observe,
  };
}

export function registerBoundPage(
  runtime: VOPRuntimeController,
  manifest: VOPPageManifest,
  bindings: VOPPageBindings,
) {
  if (manifest.pageId !== bindings.pageId) {
    throw new Error(
      `Binding page ${bindings.pageId} does not match manifest page ${manifest.pageId}.`,
    );
  }

  const bindingByCapabilityId = new Map(
    bindings.capabilities.map((binding) => [binding.capabilityId, binding]),
  );

  manifest.capabilities.forEach((capability) => {
    const binding = bindingByCapabilityId.get(capability.id);
    const descriptor: VOPComponentDescriptor = {
      id: capability.id,
      pageId: manifest.pageId,
      capabilityKind: capability.kind,
      label: capability.label,
      getElement: binding?.getElement,
    };

    runtime.registerComponent(descriptor);

    if (binding) {
      runtime.registerAdapter(new CapabilityBindingDriver(binding));
    }
  });
}
