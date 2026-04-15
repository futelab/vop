import type {
  VOPComponentAdapter,
  VOPComponentDescriptor,
} from "./runtime-types";
import type { VOPActionType } from "@futelab/vop-internal-protocol";

export class ComponentRegistry {
  private readonly components = new Map<string, VOPComponentDescriptor>();

  private readonly adapters = new Map<string, VOPComponentAdapter>();

  registerComponent(descriptor: VOPComponentDescriptor) {
    this.components.set(descriptor.id, descriptor);
  }

  registerAdapter(adapter: VOPComponentAdapter) {
    this.adapters.set(adapter.componentId, adapter);
  }

  getComponent(componentId: string) {
    return this.components.get(componentId) ?? null;
  }

  getAdapter(componentId: string, actionType?: VOPActionType) {
    const adapter = this.adapters.get(componentId) ?? null;
    if (!adapter) {
      return null;
    }

    if (actionType && !adapter.supportedActions.includes(actionType)) {
      return null;
    }

    return adapter;
  }

  listComponents() {
    return Array.from(this.components.values());
  }

  listAdapters() {
    return Array.from(this.adapters.values());
  }

  clear() {
    this.components.clear();
    this.adapters.clear();
  }
}
