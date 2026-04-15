import type {
  VOPCapabilityDescriptor,
  VOPActionType,
  VOPAppManifest,
  VOPActionDescriptor,
  VOPNavigationRule,
  VOPObservationDescriptor,
  VOPPageManifest,
} from "../protocol";
import {
  createCollectionBinding,
  createConfirmationBinding,
  createNavigationBinding,
  createStateBinding,
  registerBoundPage,
  type VOPPageBindings,
} from "../runtime";
import {
  createActionFromDescriptor,
  createTaskDefinition,
  getActionDescriptor,
} from "../runtime";
import { VOPRuntime } from "../runtime";
import { createId } from "../runtime";
import type {
  CancelAction,
  ClearFilterAction,
  ClearSelectionAction,
  ConfirmAction,
  InvokeBulkAction,
  InvokeRowAction,
  NavigateAction,
  RunSearchAction,
  SelectRowsAction,
  SetFilterAction,
  VOPActionExecutionContext,
  VOPActionExecutionResult,
  VOPRuntimeController,
} from "../runtime";

export interface VOPSymbolRef {
  file: string;
  symbol: string;
}

export interface VOPSymbolGroup {
  element: VOPSymbolRef;
  observe: VOPSymbolRef;
}

export interface VOPNavigationSymbols extends VOPSymbolGroup {
  navigate: VOPSymbolRef;
}

export interface VOPStateSymbols extends VOPSymbolGroup {
  set: VOPSymbolRef;
  clear: VOPSymbolRef;
  commit: VOPSymbolRef;
}

export interface VOPCollectionSymbols extends VOPSymbolGroup {
  select: VOPSymbolRef;
  clearSelection: VOPSymbolRef;
  invokeRow: VOPSymbolRef;
  previewBulk: VOPSymbolRef;
}

export interface VOPConfirmationSymbols extends VOPSymbolGroup {
  confirm: VOPSymbolRef;
  cancel: VOPSymbolRef;
}

export interface VOPConfiguredPage extends Omit<VOPPageManifest, "capabilities" | "actions" | "observations"> {
  capabilities: VOPCapabilityDescriptor[];
  reset?: VOPSymbolRef;
  actions: VOPActionDescriptor[];
  observations: VOPObservationDescriptor[];
  automation?: VOPAutomationSpec;
  symbols?: {
    navigation: VOPNavigationSymbols;
    state?: VOPStateSymbols;
    collection?: VOPCollectionSymbols;
    confirmation?: VOPConfirmationSymbols;
  };
}

export interface VOPPlannerConfig {
  baseURL: string;
  apiKey?: string;
  model: string;
  title?: string;
  subtitle?: string;
  welcomeMessage?: string;
  defaultPrompt?: string;
  suggestedPrompts?: Array<{
    key: string;
    label: string;
  }>;
  conversations?: Array<{
    key: string;
    label: string;
    group?: string;
  }>;
}

export interface VOPConfig {
  app: Pick<VOPAppManifest, "appId" | "version" | "entryPageId">;
  planner?: VOPPlannerConfig;
  assistant?: {
    title?: string;
    subtitle?: string;
    welcomeMessage?: string;
    defaultPrompt?: string;
    suggestedPrompts?: Array<{
      key: string;
      label: string;
    }>;
    conversations?: Array<{
      key: string;
      label: string;
      group?: string;
    }>;
  };
  pages: VOPConfiguredPage[];
  navigation: VOPNavigationRule[];
}

export interface VOPRoutePageDefinition {
  pageId: string;
  title: string;
  route: string;
  group?: string;
  rootSelector?: string;
}

export interface VOPPublicPageBase {
  pageId?: string;
  title: string;
  route: string;
  group?: string;
  rootSelector?: string;
}

export interface VOPPublicShellPage extends VOPPublicPageBase {
  kind?: "shell";
}

export interface VOPPublicTablePage extends VOPPublicPageBase {
  kind: "table";
  filters: Record<string, VOPAutomationFieldSpec>;
  filterFormSelector?: string;
  collectionSelector?: string;
  toolbarSelector?: string;
  submitFilterSelector?: string;
  resetFilterSelector?: string;
  destructiveActionSelector?: string;
  rowSelector?: string;
  rowKeyAttribute?: string;
  rowCheckboxSelector?: string;
  cellSelector?: string;
}

export interface VOPPublicFormPage extends VOPPublicPageBase {
  kind: "form";
  fields: Record<string, VOPAutomationFieldSpec>;
  formSelector?: string;
  submitButtonSelector?: string;
  resetActionSelector?: string;
}

export type VOPPublicPage =
  | VOPPublicShellPage
  | VOPPublicTablePage
  | VOPPublicFormPage;

export interface VOPPublicConfig {
  planner?: VOPPlannerConfig;
  pages: VOPPublicPage[];
}

export function defineRoutePages<T extends readonly VOPRoutePageDefinition[]>(pages: T) {
  return pages;
}

function derivePageIdFromRoute(route: string) {
  const normalized = route
    .trim()
    .replace(/\/+/g, "/")
    .replace(/(^\/|\/$)/g, "");

  if (!normalized) {
    return "root";
  }

  const parts = normalized.split("/").filter(Boolean);
  const lastPart = parts[parts.length - 1]!.replace(/[:*]/g, "");
  if (/^[A-Za-z_$]/.test(lastPart)) {
    return lastPart;
  }

  const parentPart = parts[parts.length - 2]?.replace(/[:*]/g, "") ?? "page";
  return `${parentPart}-${lastPart}`;
}

function toRoutePageDefinition(page: VOPPublicPage): VOPRoutePageDefinition {
  return {
    pageId: page.pageId ?? derivePageIdFromRoute(page.route),
    title: page.title,
    route: page.route,
    group: page.group,
    rootSelector: page.rootSelector,
  };
}

export function createShellPage(page: VOPRoutePageDefinition): VOPConfiguredPage {
  return {
    pageId: page.pageId,
    title: page.title,
    route: page.route,
    capabilities: [
      {
        id: `${page.pageId}-page`,
        kind: "navigation",
        label: `${page.title} page`,
      },
    ],
    actions: [],
    observations: [
      {
        id: `${page.pageId}-route`,
        componentId: `${page.pageId}-page`,
        description: `Current ${page.pageId} page identity`,
        fields: ["pageId"],
      },
    ],
    automation: {
      kind: "shell",
      rootSelector: page.rootSelector ?? "#root",
    },
  };
}

export function createShellPages(pages: readonly VOPRoutePageDefinition[]) {
  return pages.map((page) => createShellPage(page));
}

export type VOPActionablePageDefinition = Omit<VOPConfiguredPage, "pageId" | "title" | "route">;

export function createActionablePage(
  page: VOPRoutePageDefinition,
  definition: VOPActionablePageDefinition,
): VOPConfiguredPage {
  return {
    pageId: page.pageId,
    title: page.title,
    route: page.route,
    ...definition,
  };
}

export function createNavigationActions(
  pages: readonly Pick<VOPRoutePageDefinition, "pageId" | "title">[],
  componentId = "global-shell-page",
): VOPActionDescriptor[] {
  return pages.map((page) => ({
    id: `navigate-to-${page.pageId}`,
    type: "navigate",
    componentId,
    label: `Navigate to ${page.pageId.replace(/-/g, " ")}`,
    risk: "low",
    confirmation: { mode: "none" },
    payloadShape: { targetPageId: "string" },
  }));
}

export function createGlobalShellPage(
  pages: readonly Pick<VOPRoutePageDefinition, "pageId" | "title">[],
): VOPConfiguredPage {
  return {
    pageId: "global-shell",
    title: "Global Shell",
    route: "/",
    capabilities: [
      {
        id: "global-shell-page",
        kind: "navigation",
        label: "Global shell",
      },
    ],
    actions: createNavigationActions(pages),
    observations: [
      {
        id: "global-shell-route",
        componentId: "global-shell-page",
        description: "Current global shell route state",
        fields: ["pageId"],
      },
    ],
    automation: {
      kind: "shell",
      rootSelector: "body",
    },
  };
}

export function createDirectNavigationRules(
  pages: readonly Pick<VOPRoutePageDefinition, "pageId">[],
): VOPNavigationRule[] {
  return pages.map((page) => ({
    toPageId: page.pageId,
    kind: "direct",
  }));
}

export function createAssistantConversations(
  pages: readonly Pick<VOPRoutePageDefinition, "pageId" | "title" | "group">[],
  base: Array<{ key: string; label: string; group?: string }> = [],
) {
  return [
    ...base,
    ...pages.map((page) => ({
      key: page.pageId,
      label: page.title,
      group: page.group,
    })),
  ];
}

export function composeVopPages(
  routePages: readonly VOPRoutePageDefinition[],
  actionablePages: readonly VOPConfiguredPage[] = [],
) {
  const routePageIds = new Set(routePages.map((page) => page.pageId));
  const unknownActionablePages = actionablePages
    .map((page) => page.pageId)
    .filter((pageId) => !routePageIds.has(pageId));

  if (unknownActionablePages.length > 0) {
    throw new Error(
      `Actionable pages must exist in route pages: ${unknownActionablePages.join(", ")}.`,
    );
  }

  const actionablePageById = new Map(actionablePages.map((page) => [page.pageId, page]));

  return [
    createGlobalShellPage(routePages),
    ...routePages.map((page) => actionablePageById.get(page.pageId) ?? createShellPage(page)),
  ];
}

export function symbolRef(file: string, symbol: string): VOPSymbolRef {
  return {
    file,
    symbol,
  };
}

export type VOPAutomationFieldKind =
  | "text"
  | "textarea"
  | "date-range"
  | "radio"
  | "number";

export interface VOPAutomationFieldSpec {
  kind: VOPAutomationFieldKind;
  selector: string;
  label?: string;
  aliases?: string[];
  required?: boolean;
  description?: string;
  options?: Array<{
    label: string;
    value: string;
    aliases?: string[];
  }>;
}

export interface VOPShellAutomationSpec {
  kind: "shell";
  rootSelector: string;
}

export interface VOPTableAutomationSpec {
  kind: "table";
  rootSelector: string;
  filterFormSelector: string;
  collectionSelector: string;
  toolbarSelector?: string;
  submitFilterSelector: string;
  resetFilterSelector?: string;
  destructiveActionSelector: string;
  rowSelector: string;
  rowKeyAttribute: string;
  rowCheckboxSelector: string;
  cellSelector: string;
  filters: Record<string, VOPAutomationFieldSpec>;
}

export interface VOPFormAutomationSpec {
  kind: "form";
  rootSelector: string;
  formSelector: string;
  submitButtonSelector: string;
  resetActionSelector?: string;
  fields: Record<string, VOPAutomationFieldSpec>;
}

export type VOPAutomationSpec =
  | VOPShellAutomationSpec
  | VOPTableAutomationSpec
  | VOPFormAutomationSpec;

function isNormalizedConfig(config: VOPPublicConfig | VOPConfig): config is VOPConfig {
  return (
    "app" in config &&
    "navigation" in config &&
    Array.isArray(config.pages) &&
    config.pages.every(
      (page) =>
        "capabilities" in page &&
        "actions" in page &&
        "observations" in page,
    )
  );
}

function createNormalizedAssistantConfig(
  planner: VOPPlannerConfig | undefined,
  pages: readonly VOPRoutePageDefinition[],
) {
  return {
    title: planner?.title ?? "VOP Copilot",
    subtitle: planner?.subtitle,
    welcomeMessage: planner?.welcomeMessage ?? "",
    defaultPrompt: planner?.defaultPrompt ?? "",
    suggestedPrompts: planner?.suggestedPrompts ?? [],
    conversations:
      planner?.conversations ??
      createAssistantConversations(pages, [
        {
          key: "current-task",
          label: "Current task",
          group: "Live",
        },
      ]),
  };
}

function toActionIdPrefix(pageId: string) {
  if (pageId.endsWith("-list")) {
    return pageId.slice(0, -"-list".length);
  }

  return pageId;
}

function normalizePublicTablePage(page: VOPPublicTablePage): VOPConfiguredPage {
  const routePage = toRoutePageDefinition(page);
  const actionIdPrefix = toActionIdPrefix(routePage.pageId);

  return createActionablePage(routePage, {
    capabilities: [
      { id: `${routePage.pageId}-page`, kind: "navigation", label: `${routePage.title} page` },
      { id: `${routePage.pageId}-filters`, kind: "state", label: `${routePage.title} search form` },
      { id: `${routePage.pageId}-collection`, kind: "collection", label: `${routePage.title} collection` },
      { id: `${routePage.pageId}-confirmation`, kind: "confirmation", label: `${routePage.title} confirmation` },
    ],
    actions: [
      {
        id: `set-${actionIdPrefix}-filters`,
        type: "set_filter",
        componentId: `${routePage.pageId}-filters`,
        label: `Set ${routePage.title} filters`,
        risk: "low",
        confirmation: { mode: "none" },
        payloadShape: Object.fromEntries(
          Object.keys(page.filters).map((key) => [key, "string"]),
        ),
      },
      {
        id: `clear-${actionIdPrefix}-filters`,
        type: "clear_filter",
        componentId: `${routePage.pageId}-filters`,
        label: `Clear ${routePage.title} filters`,
        risk: "low",
        confirmation: { mode: "none" },
      },
      {
        id: `run-${actionIdPrefix}-search`,
        type: "run_search",
        componentId: `${routePage.pageId}-filters`,
        label: `Run ${routePage.title} search`,
        risk: "low",
        confirmation: { mode: "none" },
      },
      {
        id: `select-visible-${actionIdPrefix}-rows`,
        type: "select_rows",
        componentId: `${routePage.pageId}-collection`,
        label: `Select visible ${routePage.title} rows`,
        risk: "low",
        confirmation: { mode: "none" },
        payloadShape: { strategy: "visible_result_ids" },
      },
      {
        id: `clear-${actionIdPrefix}-selection`,
        type: "clear_selection",
        componentId: `${routePage.pageId}-collection`,
        label: `Clear ${routePage.title} selection`,
        risk: "low",
        confirmation: { mode: "none" },
      },
      {
        id: `prepare-delete-selected-${actionIdPrefix}-rows`,
        type: "invoke_bulk_action",
        componentId: `${routePage.pageId}-collection`,
        label: `Prepare delete selected ${routePage.title} rows`,
        risk: "high",
        confirmation: {
          mode: "required",
          title: "Confirm batch deletion",
          message: `Delete selected rows from ${routePage.title}.`,
        },
        payloadShape: { actionId: "delete_selected" },
      },
    ],
    observations: [
      {
        id: `${routePage.pageId}-route`,
        componentId: `${routePage.pageId}-page`,
        description: `Current ${routePage.pageId} page identity`,
        fields: ["pageId"],
      },
      {
        id: `${routePage.pageId}-filters-state`,
        componentId: `${routePage.pageId}-filters`,
        description: `Current ${routePage.pageId} search fields`,
        fields: Object.keys(page.filters),
      },
      {
        id: `${routePage.pageId}-collection-state`,
        componentId: `${routePage.pageId}-collection`,
        description: `Current ${routePage.pageId} visible rows and selection`,
        fields: ["visibleCount", "selectedIds", "rows"],
      },
      {
        id: `${routePage.pageId}-confirmation-state`,
        componentId: `${routePage.pageId}-confirmation`,
        description: `Current ${routePage.pageId} confirmation visibility`,
        fields: ["dialogOpen"],
      },
    ],
    automation: {
      kind: "table",
      rootSelector: page.rootSelector ?? "#root",
      filterFormSelector: page.filterFormSelector ?? "form",
      collectionSelector: page.collectionSelector ?? "table",
      toolbarSelector: page.toolbarSelector,
      submitFilterSelector: page.submitFilterSelector ?? 'button[type="submit"]',
      resetFilterSelector: page.resetFilterSelector,
      destructiveActionSelector:
        page.destructiveActionSelector ?? '[data-vop-action="delete-selected"]',
      rowSelector: page.rowSelector ?? "tbody tr",
      rowKeyAttribute: page.rowKeyAttribute ?? "data-row-key",
      rowCheckboxSelector: page.rowCheckboxSelector ?? 'input[type="checkbox"]',
      cellSelector: page.cellSelector ?? "td,th",
      filters: page.filters,
    },
  });
}

function normalizePublicFormPage(page: VOPPublicFormPage): VOPConfiguredPage {
  const routePage = toRoutePageDefinition(page);

  return createActionablePage(routePage, {
    capabilities: [
      { id: `${routePage.pageId}-page`, kind: "navigation", label: `${routePage.title} page` },
      { id: `${routePage.pageId}-state`, kind: "state", label: `${routePage.title} fields` },
    ],
    actions: [
      {
        id: `fill-${routePage.pageId}`,
        type: "set_filter",
        componentId: `${routePage.pageId}-state`,
        label: `Fill ${routePage.title}`,
        risk: "low",
        confirmation: { mode: "none" },
        payloadShape: Object.fromEntries(
          Object.entries(page.fields).map(([key, field]) => [
            key,
            field.kind === "number" ? "number" : field.kind === "date-range" ? "string[]" : "string",
          ]),
        ),
      },
      {
        id: `clear-${routePage.pageId}`,
        type: "clear_filter",
        componentId: `${routePage.pageId}-state`,
        label: `Clear ${routePage.title}`,
        risk: "low",
        confirmation: { mode: "none" },
      },
      {
        id: `submit-${routePage.pageId}`,
        type: "run_search",
        componentId: `${routePage.pageId}-state`,
        label: `Submit ${routePage.title}`,
        risk: "low",
        confirmation: { mode: "none" },
      },
    ],
    observations: [
      {
        id: `${routePage.pageId}-route`,
        componentId: `${routePage.pageId}-page`,
        description: `Current ${routePage.pageId} page identity`,
        fields: ["pageId"],
      },
      {
        id: `${routePage.pageId}-state`,
        componentId: `${routePage.pageId}-state`,
        description: `Current ${routePage.pageId} field values`,
        fields: Object.keys(page.fields),
      },
    ],
    automation: {
      kind: "form",
      rootSelector: page.rootSelector ?? "#root",
      formSelector: page.formSelector ?? "form",
      submitButtonSelector: page.submitButtonSelector ?? 'button[type="submit"]',
      resetActionSelector: page.resetActionSelector,
      fields: page.fields,
    },
  });
}

function normalizePublicConfig(config: VOPPublicConfig): VOPConfig {
  const routePages = config.pages.map((page) => toRoutePageDefinition(page));
  const actionablePages = config.pages.flatMap((page) => {
    if (page.kind === "table") {
      return [normalizePublicTablePage(page)];
    }

    if (page.kind === "form") {
      return [normalizePublicFormPage(page)];
    }

    return [];
  });

  return {
    app: {
      appId: "vop-app",
      version: "0.1.0",
      entryPageId: "global-shell",
    },
    planner: config.planner,
    assistant: createNormalizedAssistantConfig(config.planner, routePages),
    pages: composeVopPages(routePages, actionablePages),
    navigation: createDirectNavigationRules(routePages),
  };
}

export function defineVopConfig<T extends VOPPublicConfig | VOPConfig>(config: T): VOPConfig {
  return isNormalizedConfig(config) ? config : normalizePublicConfig(config);
}

interface RuntimeBindingBase {
  getElement?: () => HTMLElement | null;
  observe?: () => object;
}

export interface VOPNavigationRuntimeBinding extends RuntimeBindingBase {
  navigate: (
    action: NavigateAction,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
}

export interface VOPStateRuntimeBinding extends RuntimeBindingBase {
  setFilter: (
    action: SetFilterAction,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
  clearFilter: (
    action: ClearFilterAction,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
  runSearch: (
    action: RunSearchAction,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
}

export interface VOPCollectionRuntimeBinding extends RuntimeBindingBase {
  selectRows: (
    action: SelectRowsAction,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
  clearSelection: (
    action: ClearSelectionAction,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
  invokeRowAction: (
    action: InvokeRowAction,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
  invokeBulkAction: (
    action: InvokeBulkAction,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
}

export interface VOPConfirmationRuntimeBinding extends RuntimeBindingBase {
  confirmAction: (
    action: ConfirmAction,
    context: VOPActionExecutionContext,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
  cancelAction: (
    action: CancelAction,
    context: VOPActionExecutionContext,
  ) => Promise<VOPActionExecutionResult | void> | VOPActionExecutionResult | void;
}

export interface VOPPageRuntimeBindings {
  reset?: () => void;
  navigation: VOPNavigationRuntimeBinding;
  state?: VOPStateRuntimeBinding;
  collection?: VOPCollectionRuntimeBinding;
  confirmation?: VOPConfirmationRuntimeBinding;
}

export interface VOPRuntimeConfiguredPage extends VOPConfiguredPage {
  runtime: VOPPageRuntimeBindings;
}

export interface VOPRuntimeConfig extends Omit<VOPConfig, "pages"> {
  pages: VOPRuntimeConfiguredPage[];
}

function normalizeResult(
  result: VOPActionExecutionResult | void,
  summary: string,
  highlightComponentId?: string,
): VOPActionExecutionResult {
  if (result) {
    return result;
  }

  return {
    status: "success",
    summary,
    highlightComponentId,
  };
}

export function toAppManifest(config: VOPConfig): VOPAppManifest {
  return {
    appId: config.app.appId,
    version: config.app.version,
    entryPageId: config.app.entryPageId,
    pages: config.pages.map((page) => ({
      pageId: page.pageId,
      title: page.title,
      route: page.route,
      capabilities: page.capabilities,
      actions: page.actions,
      observations: page.observations,
    })),
    navigation: config.navigation,
  };
}

function toPageManifest(page: VOPConfiguredPage): VOPPageManifest {
  return {
    pageId: page.pageId,
    title: page.title,
    route: page.route,
    capabilities: page.capabilities,
    actions: page.actions,
    observations: page.observations,
  };
}

function createBindings(page: VOPRuntimeConfiguredPage): VOPPageBindings {
  const bindings = [
    createNavigationBinding({
      capabilityId: page.capabilities.find((capability) => capability.kind === "navigation")?.id ?? `${page.pageId}-navigation`,
      getElement: page.runtime.navigation.getElement,
      observe: page.runtime.navigation.observe,
      async navigate(action) {
        const result = await page.runtime.navigation.navigate(action);
        return normalizeResult(
          result,
          `Navigated to ${action.payload.targetPageId}.`,
          page.capabilities.find((capability) => capability.kind === "navigation")?.id,
        );
      },
    }),
  ];

  if (page.runtime.state) {
    const stateCapabilityId =
      page.capabilities.find((capability) => capability.kind === "state")?.id ??
      `${page.pageId}-state`;

    bindings.push(
      createStateBinding({
        capabilityId: stateCapabilityId,
        getElement: page.runtime.state.getElement,
        observe: page.runtime.state.observe,
        async setFilter(action) {
          const result = await page.runtime.state?.setFilter(action);
          return normalizeResult(result, `Updated state on ${page.title}.`, stateCapabilityId);
        },
        async clearFilter(action) {
          const result = await page.runtime.state?.clearFilter(action);
          return normalizeResult(result, `Cleared state on ${page.title}.`, stateCapabilityId);
        },
        async runSearch(action) {
          const result = await page.runtime.state?.runSearch(action);
          return normalizeResult(result, `Committed state on ${page.title}.`, stateCapabilityId);
        },
      }),
    );
  }

  if (page.runtime.collection) {
    const collectionCapabilityId =
      page.capabilities.find((capability) => capability.kind === "collection")?.id ??
      `${page.pageId}-collection`;

    bindings.push(
      createCollectionBinding({
        capabilityId: collectionCapabilityId,
        getElement: page.runtime.collection.getElement,
        observe: page.runtime.collection.observe,
        async selectRows(action) {
          const result = await page.runtime.collection?.selectRows(action);
          return normalizeResult(result, `Selected rows on ${page.title}.`, collectionCapabilityId);
        },
        async clearSelection(action) {
          const result = await page.runtime.collection?.clearSelection(action);
          return normalizeResult(result, `Cleared selection on ${page.title}.`, collectionCapabilityId);
        },
        async invokeRowAction(action) {
          const result = await page.runtime.collection?.invokeRowAction(action);
          return normalizeResult(result, `Invoked row action on ${page.title}.`, collectionCapabilityId);
        },
        async invokeBulkAction(action) {
          const result = await page.runtime.collection?.invokeBulkAction(action);
          return normalizeResult(result, `Prepared bulk action on ${page.title}.`, collectionCapabilityId);
        },
      }),
    );
  }

  if (page.runtime.confirmation) {
    const confirmationCapabilityId =
      page.capabilities.find((capability) => capability.kind === "confirmation")?.id ??
      `${page.pageId}-confirmation`;

    bindings.push(
      createConfirmationBinding({
        capabilityId: confirmationCapabilityId,
        getElement: page.runtime.confirmation.getElement,
        observe: page.runtime.confirmation.observe,
        async confirmAction(action, context) {
          const result = await page.runtime.confirmation?.confirmAction(action, context);
          return normalizeResult(result, `Confirmed action on ${page.title}.`, confirmationCapabilityId);
        },
        async cancelAction(action, context) {
          const result = await page.runtime.confirmation?.cancelAction(action, context);
          return normalizeResult(result, `Cancelled action on ${page.title}.`, confirmationCapabilityId);
        },
      }),
    );
  }

  return {
    pageId: page.pageId,
    capabilities: bindings,
  };
}

export function registerConfiguredApp(
  runtime: VOPRuntimeController,
  config: VOPRuntimeConfig,
) {
  const appManifest = toAppManifest(config);
  runtime.registerAppManifest(appManifest);

  for (const page of config.pages) {
    registerBoundPage(runtime, toPageManifest(page), createBindings(page));
  }
}

export function resetConfiguredPages(config: VOPRuntimeConfig) {
  for (const page of config.pages) {
    page.runtime.reset?.();
  }
}

interface PlannedActionStep {
  pageId: string;
  actionId: string;
  payload: Record<string, unknown>;
}

interface ConfiguredRuntimeAppOptions {
  getCurrentPageId: () => string;
  navigateToPageId: (pageId: string) => void | Promise<void>;
  waitForPaint?: (delay?: number) => Promise<void>;
}

export function createConfiguredRuntimeApp(
  config: VOPRuntimeConfig,
  options: ConfiguredRuntimeAppOptions,
) {
  const runtime = new VOPRuntime();
  registerConfiguredApp(runtime, config);
  const appManifest = toAppManifest(config);
  const pageManifests = config.pages.map((page) => toPageManifest(page));
  const pageMap = new Map(pageManifests.map((page) => [page.pageId, page]));

  return {
    runtime,
    appManifest,
    pageManifests,
    getCurrentPageId: options.getCurrentPageId,
    navigateToPageId: options.navigateToPageId,
    waitForPaint: options.waitForPaint ?? (async () => undefined),
    buildTaskFromPlan(input: {
      intent: string;
      startPageId?: string;
      actions: PlannedActionStep[];
    }) {
      const actions = input.actions.map((step) => {
        const page = pageMap.get(step.pageId);
        if (!page) {
          throw new Error(`Unknown VOP page: ${step.pageId}`);
        }

        const descriptor = getActionDescriptor(page, step.actionId);
        return createActionFromDescriptor(descriptor, step.payload);
      });

      return createTaskDefinition(
        input.startPageId ?? options.getCurrentPageId(),
        {
          id: createId("intent"),
          text: input.intent,
        },
        actions,
      );
    },
  };
}
