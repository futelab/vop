export interface VOPNavigationObservation {
  pageId: string;
}

export interface VOPNavigationCapabilityHost {
  pageId: string;
  navigateToPage(pageId: string): Promise<void>;
  observeNavigation(): VOPNavigationObservation;
}

export interface VOPStateCapabilityHost<
  TUpdateInput,
  TObservation extends object,
> {
  setState(input: TUpdateInput): Promise<void>;
  clearState(): Promise<void>;
  commitState(): Promise<void>;
  observeState(): TObservation;
}

export interface VOPCollectionCapabilityHost<
  TRow extends object,
  TBulkAction extends string,
> {
  selectVisible(): Promise<{ selectedIds: string[] }>;
  clearSelection(): Promise<void>;
  previewBulkAction(actionId: TBulkAction): Promise<{
    selectedIds: string[];
    count: number;
  }>;
  commitBulkAction(actionId: TBulkAction): Promise<{
    affectedIds: string[];
    affectedCount: number;
  }>;
  observeCollection(): {
    visibleCount: number;
    selectedIds: string[];
    rows: TRow[];
  };
}

export interface VOPConfirmationCapabilityHost<
  TObservation extends object,
> {
  openConfirmation(config: { title: string; message: string }): Promise<void>;
  closeConfirmation(): Promise<void>;
  observeConfirmation(): TObservation;
}

export interface VOPPageCapabilityHosts<
  TStateInput,
  TStateObservation extends object,
  TCollectionRow extends object,
  TBulkAction extends string,
  TConfirmationObservation extends object = { open: boolean },
> {
  navigation: VOPNavigationCapabilityHost;
  state: VOPStateCapabilityHost<TStateInput, TStateObservation>;
  collection: VOPCollectionCapabilityHost<TCollectionRow, TBulkAction>;
  confirmation: VOPConfirmationCapabilityHost<TConfirmationObservation>;
}
