export class HighlightManager {
  private highlightedComponentId: string | null = null;

  focus(componentId: string | null) {
    this.highlightedComponentId = componentId;
  }

  getHighlightedComponentId() {
    return this.highlightedComponentId;
  }

  clear() {
    this.highlightedComponentId = null;
  }
}
