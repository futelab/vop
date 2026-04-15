import fs from "node:fs";
import path from "node:path";
import { transformWithEsbuild } from "vite";

function parseArgs(argv) {
  const args = {
    config: "",
    out: "",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") {
      args.config = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--out") {
      args.out = argv[i + 1] ?? "";
      i += 1;
    }
  }

  if (!args.config) {
    throw new Error("Usage: node generate-vop.mjs --config <vop.config.ts> [--out <output-file-or-dir>]");
  }

  return args;
}

async function loadTsModule(filePath) {
  const source = fs
    .readFileSync(filePath, "utf8")
    .replace(
      /import\s+\{[\s\S]*?\}\s+from\s+['"](?:@repo\/vop\/sdk|vop\/sdk|@futelab\/vop\/sdk)['"];?/g,
      `const defineVopConfig = (config) => config;
const defineRoutePages = (pages) => pages;
const createShellPage = (page) => ({
  pageId: page.pageId,
  title: page.title,
  route: page.route,
  capabilities: [
    {
      id: \`\${page.pageId}-page\`,
      kind: "navigation",
      label: \`\${page.title} page\`,
    },
  ],
  actions: [],
  observations: [
    {
      id: \`\${page.pageId}-route\`,
      componentId: \`\${page.pageId}-page\`,
      description: \`Current \${page.pageId} page identity\`,
      fields: ["pageId"],
    },
  ],
  automation: {
    kind: "shell",
    rootSelector: page.rootSelector ?? "#root",
  },
});
const createShellPages = (pages) => pages.map((page) => createShellPage(page));
const createActionablePage = (page, definition) => ({
  pageId: page.pageId,
  title: page.title,
  route: page.route,
  ...definition,
});
const createNavigationActions = (pages, componentId = "global-shell-page") =>
  pages.map((page) => ({
    id: \`navigate-to-\${page.pageId}\`,
    type: "navigate",
    componentId,
    label: \`Navigate to \${page.pageId.replace(/-/g, " ")}\`,
    risk: "low",
    confirmation: { mode: "none" },
    payloadShape: { targetPageId: "string" },
  }));
const createGlobalShellPage = (pages) => ({
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
});
const createDirectNavigationRules = (pages) =>
  pages.map((page) => ({
    toPageId: page.pageId,
    kind: "direct",
  }));
const createAssistantConversations = (pages, base = []) => [
  ...base,
  ...pages.map((page) => ({
    key: page.pageId,
    label: page.title,
    group: page.group,
  })),
];
const composeVopPages = (routePages, actionablePages = []) => {
  const actionablePageById = new Map(
    actionablePages.map((page) => [page.pageId, page]),
  );
  return [
    createGlobalShellPage(routePages),
    ...routePages.map((page) => actionablePageById.get(page.pageId) ?? createShellPage(page)),
  ];
};`,
    );
  const transformed = await transformWithEsbuild(source, filePath, {
    loader: "ts",
    format: "esm",
    sourcemap: false,
    tsconfigRaw: {
      compilerOptions: {
        target: "es2020",
      },
    },
  });

  const encoded = Buffer.from(transformed.code).toString("base64");
  return import(`data:text/javascript;base64,${encoded}`);
}

function toLiteral(value) {
  return JSON.stringify(value, null, 2);
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9_$]/g, "_");
}

function resolveOutputPath(configPath, outArg) {
  const configDir = path.dirname(configPath);
  if (!outArg) {
    return path.join(configDir, "src", "vop.generated.ts");
  }

  const resolved = path.resolve(process.cwd(), outArg);
  if (path.extname(resolved)) {
    return resolved;
  }

  return path.join(resolved, "vop.generated.ts");
}

function derivePageIdFromRoute(route) {
  const normalized = route
    .trim()
    .replace(/\/+/g, "/")
    .replace(/(^\/|\/$)/g, "");

  if (!normalized) {
    return "root";
  }

  const parts = normalized.split("/").filter(Boolean);
  const lastPart = parts[parts.length - 1].replace(/[:*]/g, "");
  if (/^[A-Za-z_$]/.test(lastPart)) {
    return lastPart;
  }

  const parentPart = (parts[parts.length - 2] ?? "page").replace(/[:*]/g, "");
  return `${parentPart}-${lastPart}`;
}

function normalizePublicConfigForGeneration(config) {
  if (config.app && config.navigation) {
    return config;
  }

  const routePages = config.pages.map((page) => ({
    ...page,
    pageId: page.pageId ?? derivePageIdFromRoute(page.route),
  }));

  const actionablePages = routePages.flatMap((page) => {
    if (page.kind === "table") {
      const actionIdPrefix = page.pageId.endsWith("-list")
        ? page.pageId.slice(0, -"-list".length)
        : page.pageId;

      return [{
        pageId: page.pageId,
        title: page.title,
        route: page.route,
        capabilities: [
          { id: `${page.pageId}-page`, kind: "navigation", label: `${page.title} page` },
          { id: `${page.pageId}-filters`, kind: "state", label: `${page.title} search form` },
          { id: `${page.pageId}-collection`, kind: "collection", label: `${page.title} collection` },
          { id: `${page.pageId}-confirmation`, kind: "confirmation", label: `${page.title} confirmation` },
        ],
        actions: [
          {
            id: `set-${actionIdPrefix}-filters`,
            type: "set_filter",
            componentId: `${page.pageId}-filters`,
            label: `Set ${page.title} filters`,
            risk: "low",
            confirmation: { mode: "none" },
            payloadShape: Object.fromEntries(Object.keys(page.filters).map((key) => [key, "string"])),
          },
          {
            id: `clear-${actionIdPrefix}-filters`,
            type: "clear_filter",
            componentId: `${page.pageId}-filters`,
            label: `Clear ${page.title} filters`,
            risk: "low",
            confirmation: { mode: "none" },
          },
          {
            id: `run-${actionIdPrefix}-search`,
            type: "run_search",
            componentId: `${page.pageId}-filters`,
            label: `Run ${page.title} search`,
            risk: "low",
            confirmation: { mode: "none" },
          },
          {
            id: `select-visible-${actionIdPrefix}-rows`,
            type: "select_rows",
            componentId: `${page.pageId}-collection`,
            label: `Select visible ${page.title} rows`,
            risk: "low",
            confirmation: { mode: "none" },
            payloadShape: { strategy: "visible_result_ids" },
          },
          {
            id: `clear-${actionIdPrefix}-selection`,
            type: "clear_selection",
            componentId: `${page.pageId}-collection`,
            label: `Clear ${page.title} selection`,
            risk: "low",
            confirmation: { mode: "none" },
          },
          {
            id: `prepare-delete-selected-${actionIdPrefix}-rows`,
            type: "invoke_bulk_action",
            componentId: `${page.pageId}-collection`,
            label: `Prepare delete selected ${page.title} rows`,
            risk: "high",
            confirmation: {
              mode: "required",
              title: "Confirm batch deletion",
              message: `Delete selected rows from ${page.title}.`,
            },
            payloadShape: { actionId: "delete_selected" },
          },
        ],
        observations: [
          {
            id: `${page.pageId}-route`,
            componentId: `${page.pageId}-page`,
            description: `Current ${page.pageId} page identity`,
            fields: ["pageId"],
          },
          {
            id: `${page.pageId}-filters-state`,
            componentId: `${page.pageId}-filters`,
            description: `Current ${page.pageId} search fields`,
            fields: Object.keys(page.filters),
          },
          {
            id: `${page.pageId}-collection-state`,
            componentId: `${page.pageId}-collection`,
            description: `Current ${page.pageId} visible rows and selection`,
            fields: ["visibleCount", "selectedIds", "rows"],
          },
          {
            id: `${page.pageId}-confirmation-state`,
            componentId: `${page.pageId}-confirmation`,
            description: `Current ${page.pageId} confirmation visibility`,
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
          destructiveActionSelector: page.destructiveActionSelector ?? '[data-vop-action="delete-selected"]',
          rowSelector: page.rowSelector ?? "tbody tr",
          rowKeyAttribute: page.rowKeyAttribute ?? "data-row-key",
          rowCheckboxSelector: page.rowCheckboxSelector ?? 'input[type="checkbox"]',
          cellSelector: page.cellSelector ?? "td,th",
          filters: page.filters,
        },
      }];
    }

    if (page.kind === "form") {
      return [{
        pageId: page.pageId,
        title: page.title,
        route: page.route,
        capabilities: [
          { id: `${page.pageId}-page`, kind: "navigation", label: `${page.title} page` },
          { id: `${page.pageId}-state`, kind: "state", label: `${page.title} fields` },
        ],
        actions: [
          {
            id: `fill-${page.pageId}`,
            type: "set_filter",
            componentId: `${page.pageId}-state`,
            label: `Fill ${page.title}`,
            risk: "low",
            confirmation: { mode: "none" },
            payloadShape: Object.fromEntries(Object.entries(page.fields).map(([key, field]) => [key, field.kind === "number" ? "number" : field.kind === "date-range" ? "string[]" : "string"])),
          },
          {
            id: `clear-${page.pageId}`,
            type: "clear_filter",
            componentId: `${page.pageId}-state`,
            label: `Clear ${page.title}`,
            risk: "low",
            confirmation: { mode: "none" },
          },
          {
            id: `submit-${page.pageId}`,
            type: "run_search",
            componentId: `${page.pageId}-state`,
            label: `Submit ${page.title}`,
            risk: "low",
            confirmation: { mode: "none" },
          },
        ],
        observations: [
          {
            id: `${page.pageId}-route`,
            componentId: `${page.pageId}-page`,
            description: `Current ${page.pageId} page identity`,
            fields: ["pageId"],
          },
          {
            id: `${page.pageId}-state`,
            componentId: `${page.pageId}-state`,
            description: `Current ${page.pageId} field values`,
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
      }];
    }

    return [];
  });

  const actionables = new Map(actionablePages.map((page) => [page.pageId, page]));
  return {
    app: {
      appId: "vop-app",
      version: "0.1.0",
      entryPageId: "global-shell",
    },
    planner: config.planner,
    assistant: {
      title: config.planner?.title ?? "VOP Copilot",
      subtitle: config.planner?.subtitle,
      welcomeMessage: config.planner?.welcomeMessage ?? "",
      defaultPrompt: config.planner?.defaultPrompt ?? "",
      suggestedPrompts: config.planner?.suggestedPrompts ?? [],
      conversations:
        config.planner?.conversations ??
        [
          { key: "current-task", label: "Current task", group: "Live" },
          ...routePages.map((page) => ({
            key: page.pageId,
            label: page.title,
            group: page.group,
          })),
        ],
    },
    pages: [
      {
        pageId: "global-shell",
        title: "Global Shell",
        route: "/",
        capabilities: [{ id: "global-shell-page", kind: "navigation", label: "Global shell" }],
        actions: routePages.map((page) => ({
          id: `navigate-to-${page.pageId}`,
          type: "navigate",
          componentId: "global-shell-page",
          label: `Navigate to ${page.pageId.replace(/-/g, " ")}`,
          risk: "low",
          confirmation: { mode: "none" },
          payloadShape: { targetPageId: "string" },
        })),
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
      },
      ...routePages.map((page) => actionables.get(page.pageId) ?? ({
        pageId: page.pageId,
        title: page.title,
        route: page.route,
        capabilities: [{ id: `${page.pageId}-page`, kind: "navigation", label: `${page.title} page` }],
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
      })),
    ],
    navigation: routePages.map((page) => ({ toPageId: page.pageId, kind: "direct" })),
  };
}

function generateFieldSetter(fieldName, fieldSpec) {
  if (fieldSpec.kind === "date-range") {
    return `
  if (Array.isArray(action.payload.${fieldName})) {
    const dateInputs = Array.from(form.querySelectorAll(${JSON.stringify(fieldSpec.selector)}));
    if (dateInputs.length >= 2) {
      dateInputs.forEach((input) => input.removeAttribute?.("readonly"));
      setInputValue(dateInputs[0], String(action.payload.${fieldName}[0] ?? ""));
      setInputValue(dateInputs[1], String(action.payload.${fieldName}[1] ?? ""));
      dateInputs[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      dateInputs[1].dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
      dateInputs[1].blur();
    }
  }`;
  }

  if (fieldSpec.kind === "radio") {
    return `
  if (action.payload.${fieldName} !== undefined) {
    const radio = form.querySelector(\`${fieldSpec.selector}\`.replace("__VALUE__", String(action.payload.${fieldName})));
    radio?.click();
  }`;
  }

  if (fieldSpec.kind === "number") {
    return `
  if (typeof action.payload.${fieldName} === "number" || typeof action.payload.${fieldName} === "string") {
    const field = form.querySelector(${JSON.stringify(fieldSpec.selector)});
    if (field) {
      setInputValue(field, String(action.payload.${fieldName}));
    }
  }`;
  }

  return `
  if (typeof action.payload.${fieldName} === "string") {
    const field = form.querySelector(${JSON.stringify(fieldSpec.selector)});
    if (field) {
      setInputValue(field, action.payload.${fieldName});
    }
  }`;
}

function generateStateReader(fieldName, fieldSpec) {
  if (fieldSpec.kind === "date-range") {
    return `
    ${JSON.stringify(fieldName)}: Array.from(form.querySelectorAll(${JSON.stringify(fieldSpec.selector)})).map((node) => node.value),`;
  }

  if (fieldSpec.kind === "radio") {
    return `
    ${JSON.stringify(fieldName)}: Array.from(form.querySelectorAll('input[type="radio"]')).find((node) => node.checked)?.value ?? "",`;
  }

  return `
    ${JSON.stringify(fieldName)}: form.querySelector(${JSON.stringify(fieldSpec.selector)})?.value ?? "",`;
}

function generatePageAdapter(page) {
  const { automation } = page;
  const safePageId = safeName(page.pageId);
  if (!automation) {
    throw new Error(`Page ${page.pageId} is missing automation metadata.`);
  }

  if (automation.kind === "shell") {
    return `// @ts-nocheck

export function reset_${safePageId}() {}

export function get_${safePageId}_page_element() {
  return document.querySelector(${JSON.stringify(automation.rootSelector)});
}

export async function navigate_${safePageId}(targetPageId, helpers) {
  helpers.navigateToPageId(targetPageId);
  await helpers.waitForPaint();
}

export function observe_${safePageId}(helpers) {
  return { pageId: helpers.getCurrentPageId() };
}
`;
  }

  if (automation.kind === "form") {
    const fieldSetters = Object.entries(automation.fields)
      .map(([fieldName, fieldSpec]) => generateFieldSetter(fieldName, fieldSpec))
      .join("\n");
    const fieldReaders = Object.entries(automation.fields)
      .map(([fieldName, fieldSpec]) => generateStateReader(fieldName, fieldSpec))
      .join("\n");

const helperPrelude = `
function setInputValue(element, value) {
  element.focus?.();
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
}

async function waitForSelector(selector, helpers, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await helpers.waitForPaint(80);
  }
  return null;
}

function triggerControl(node) {
  const clickable = node?.closest?.("label") ?? node?.parentElement ?? node;
  clickable?.click?.();
}
`;

    return `// @ts-nocheck

${helperPrelude}

export function reset_${safePageId}() {
  ${
    automation.resetActionSelector
      ? `const button = document.querySelector(${JSON.stringify(automation.resetActionSelector)});
  button?.click?.();`
      : "return;"
  }
}

export function get_${safePageId}_page_element() {
  return document.querySelector(${JSON.stringify(automation.rootSelector)});
}

export function get_${safePageId}_state_element() {
  return document.querySelector(${JSON.stringify(automation.formSelector)});
}

export async function navigate_${safePageId}(targetPageId, helpers) {
  helpers.navigateToPageId(targetPageId);
  await waitForSelector(${JSON.stringify(automation.formSelector)}, helpers);
  await helpers.waitForPaint(120);
}

export function observe_${safePageId}(helpers) {
  return { pageId: helpers.getCurrentPageId() };
}

export async function set_${safePageId}_state(action) {
  const form = document.querySelector(${JSON.stringify(automation.formSelector)});
  if (!form) return;
${fieldSetters}
}

export async function clear_${safePageId}_state() {
  ${
    automation.resetActionSelector
      ? `const button = document.querySelector(${JSON.stringify(automation.resetActionSelector)});
  button?.click?.();`
      : "return;"
  }
}

export async function commit_${safePageId}_state(helpers) {
  const button = document.querySelector(${JSON.stringify(automation.submitButtonSelector)});
  button?.click?.();
  await helpers.waitForPaint(320);
  return 1;
}

export function read_${safePageId}_state() {
  const form = document.querySelector(${JSON.stringify(automation.formSelector)});
  if (!form) return {};
  return {${fieldReaders}
  };
}
`;
  }

  const helperPrelude = `
function setInputValue(element, value) {
  element.focus?.();
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.blur();
}

async function waitForSelector(selector, helpers, attempts = 20) {
  for (let index = 0; index < attempts; index += 1) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await helpers.waitForPaint(80);
  }
  return null;
}
`;

  return `// @ts-nocheck

${helperPrelude}

const ${safePageId}_state = {
  selectedRows: [],
  confirmation: {
    open: false,
    title: "",
    message: "",
  },
};

function get_${safePageId}_rows() {
  return Array.from(document.querySelectorAll(${JSON.stringify(automation.rowSelector)})).map((row) => ({
    key: String(row.getAttribute(${JSON.stringify(automation.rowKeyAttribute)}) ?? ""),
    checkbox: row.querySelector(${JSON.stringify(automation.rowCheckboxSelector)}),
    cells: Array.from(row.querySelectorAll(${JSON.stringify(automation.cellSelector)})).map((cell) => cell.textContent?.trim() ?? ""),
    text: row.textContent?.trim() ?? "",
  }));
}

export function reset_${safePageId}() {
  ${safePageId}_state.selectedRows = [];
  ${safePageId}_state.confirmation = { open: false, title: "", message: "" };
}

export function get_${safePageId}_page_element() {
  return document.querySelector(${JSON.stringify(automation.rootSelector)});
}

export function get_${safePageId}_state_element() {
  return document.querySelector(${JSON.stringify(automation.filterFormSelector)});
}

export function get_${safePageId}_collection_element() {
  return document.querySelector(${JSON.stringify(automation.collectionSelector)});
}

export function get_${safePageId}_confirmation_element() {
  return ${automation.toolbarSelector ? `document.querySelector(${JSON.stringify(automation.toolbarSelector)}) ?? ` : ""}get_${safePageId}_collection_element();
}

export async function navigate_${safePageId}(targetPageId, helpers) {
  helpers.navigateToPageId(targetPageId);
  await waitForSelector(${JSON.stringify(automation.filterFormSelector)}, helpers);
  await helpers.waitForPaint(120);
}

export function observe_${safePageId}(helpers) {
  return { pageId: helpers.getCurrentPageId() };
}

export async function set_${safePageId}_state(action) {
  const form = document.querySelector(${JSON.stringify(automation.filterFormSelector)});
  if (!form) return;
${Object.entries(automation.filters)
  .map(([fieldName, fieldSpec]) => generateFieldSetter(fieldName, fieldSpec))
  .join("\n")}
}

export async function clear_${safePageId}_state() {
  ${
    automation.resetFilterSelector
      ? `const button = document.querySelector(${JSON.stringify(automation.resetFilterSelector)});
  button?.click?.();`
      : "return;"
  }
}

export async function commit_${safePageId}_state(helpers) {
  const button = document.querySelector(${JSON.stringify(automation.submitFilterSelector)});
  button?.click?.();
  await waitForSelector(${JSON.stringify(automation.rowSelector)}, helpers, 100);
  await helpers.waitForPaint(200);
  return get_${safePageId}_rows().length;
}

export function read_${safePageId}_state() {
  const form = document.querySelector(${JSON.stringify(automation.filterFormSelector)});
  if (!form) return {};
  return {${Object.entries(automation.filters)
    .map(([fieldName, fieldSpec]) => generateStateReader(fieldName, fieldSpec))
    .join("\n")}
  };
}

export async function select_${safePageId}_rows(helpers) {
  await waitForSelector(${JSON.stringify(automation.rowSelector)}, helpers, 100);
  const rows = get_${safePageId}_rows().filter((row) => !row.checkbox?.disabled);
  rows.forEach((row) => {
    if (row.checkbox && !row.checkbox.checked) {
      triggerControl(row.checkbox);
    }
  });
  await helpers.waitForPaint(120);
  ${safePageId}_state.selectedRows = rows.map(({ checkbox: _checkbox, ...rest }) => rest);
  return {
    selectedIds: ${safePageId}_state.selectedRows.map((row) => row.key),
  };
}

export async function clear_${safePageId}_selection(helpers) {
  get_${safePageId}_rows().forEach((row) => {
    if (row.checkbox?.checked) {
      triggerControl(row.checkbox);
    }
  });
  await helpers.waitForPaint(120);
  ${safePageId}_state.selectedRows = [];
}

export async function invoke_${safePageId}_row_action() {}

export async function preview_${safePageId}_bulk(action) {
  if (${safePageId}_state.selectedRows.length === 0) {
    throw new Error("No selected rows.");
  }
  ${safePageId}_state.confirmation = {
    open: true,
    title: "Confirm batch deletion",
    message: \`Delete \${${safePageId}_state.selectedRows.length} selected rows from the table list?\`,
  };
  return {
    actionId: action.payload.actionId,
    selectedIds: ${safePageId}_state.selectedRows.map((row) => row.key),
    count: ${safePageId}_state.selectedRows.length,
    title: ${safePageId}_state.confirmation.title,
    message: ${safePageId}_state.confirmation.message,
  };
}

export function observe_${safePageId}_collection() {
  const rows = get_${safePageId}_rows().map(({ checkbox: _checkbox, ...rest }) => rest);
  return {
    visibleCount: rows.length,
    selectedIds: ${safePageId}_state.selectedRows.map((row) => row.key),
    rows,
  };
}

export async function confirm_${safePageId}_action(helpers) {
  const button = document.querySelector(${JSON.stringify(automation.destructiveActionSelector)});
  button?.click?.();
  ${safePageId}_state.confirmation = { open: false, title: "", message: "" };
  ${safePageId}_state.selectedRows = [];
  await helpers.waitForPaint(260);
  return {
    affectedIds: [],
    affectedCount: 0,
  };
}

export async function cancel_${safePageId}_action() {
  ${safePageId}_state.confirmation = { open: false, title: "", message: "" };
}

export function observe_${safePageId}_confirmation() {
  return {
    dialogOpen: ${safePageId}_state.confirmation.open,
  };
}
`;
}

function getPageModuleExportNames(page) {
  const safePageId = safeName(page.pageId);
  if (page.automation.kind === "shell") {
    return [
      `reset_${safePageId}`,
      `get_${safePageId}_page_element`,
      `navigate_${safePageId}`,
      `observe_${safePageId}`,
    ];
  }

  if (page.automation.kind === "form") {
    return [
      `reset_${safePageId}`,
      `get_${safePageId}_page_element`,
      `get_${safePageId}_state_element`,
      `navigate_${safePageId}`,
      `observe_${safePageId}`,
      `set_${safePageId}_state`,
      `clear_${safePageId}_state`,
      `commit_${safePageId}_state`,
      `read_${safePageId}_state`,
    ];
  }

  return [
    `reset_${safePageId}`,
    `get_${safePageId}_page_element`,
    `get_${safePageId}_state_element`,
    `get_${safePageId}_collection_element`,
    `get_${safePageId}_confirmation_element`,
    `navigate_${safePageId}`,
    `observe_${safePageId}`,
    `set_${safePageId}_state`,
    `clear_${safePageId}_state`,
    `commit_${safePageId}_state`,
    `read_${safePageId}_state`,
    `select_${safePageId}_rows`,
    `clear_${safePageId}_selection`,
    `invoke_${safePageId}_row_action`,
    `preview_${safePageId}_bulk`,
    `observe_${safePageId}_collection`,
    `confirm_${safePageId}_action`,
    `cancel_${safePageId}_action`,
    `observe_${safePageId}_confirmation`,
  ];
}

function generateInlinePageModule(page) {
  const safePageId = safeName(page.pageId);
  const moduleBody = generatePageAdapter(page)
    .replace(/^\/\/ @ts-nocheck\s*/u, "")
    .replace(/^export\s+/gmu, "");
  const exportNames = getPageModuleExportNames(page);

  return `const ${safePageId} = (() => {
${moduleBody}
  return {
    ${exportNames.join(",\n    ")}
  };
})();`;
}

function generateRuntimeFile(configImportPath, pages) {
  const pageRouteMap = Object.fromEntries(
    pages.map((page) => [page.pageId, page.route]),
  );

  const imports = [
    `import { createConfiguredRuntimeApp } from "@futelab/vop/sdk";`,
    `import vopConfig from ${JSON.stringify(configImportPath)};`,
  ];
  const inlineModules = pages.map((page) => generateInlinePageModule(page)).join("\n\n");

  const runtimePages = pages
    .map((page) => {
      const ns = safeName(page.pageId);
      const safePageId = safeName(page.pageId);
      const automation = page.automation;

      if (!automation) {
        throw new Error(`Page ${page.pageId} is missing automation metadata.`);
      }

      const runtimeBlocks = [];
      runtimeBlocks.push(`navigation: {
        getElement: ${ns}.get_${safePageId}_page_element,
        navigate: async (action) => {
          await ${ns}.navigate_${safePageId}(action.payload.targetPageId, app);
        },
        observe: () => ${ns}.observe_${safePageId}(app),
      }`);

      if (automation.kind === "table" || automation.kind === "form") {
        runtimeBlocks.push(`state: {
        getElement: ${ns}.get_${safePageId}_state_element,
        setFilter: async (action) => {
          await ${ns}.set_${safePageId}_state(action);
        },
        clearFilter: async () => {
          await ${ns}.clear_${safePageId}_state();
        },
        runSearch: async () => {
          const count = await ${ns}.commit_${safePageId}_state(app);
          return {
            status: "success",
            summary: \`Committed state on ${page.title}.\`,
            data: { count },
          };
        },
        observe: ${ns}.read_${safePageId}_state,
      }`);
      }

      if (automation.kind === "table") {
        runtimeBlocks.push(`collection: {
        getElement: ${ns}.get_${safePageId}_collection_element,
        selectRows: async () => {
          const selection = await ${ns}.select_${safePageId}_rows(app);
          return {
            status: "success",
            summary: \`Selected \${selection.selectedIds.length} rows from ${page.title}.\`,
          };
        },
        clearSelection: async () => {
          await ${ns}.clear_${safePageId}_selection(app);
        },
        invokeRowAction: ${ns}.invoke_${safePageId}_row_action,
        invokeBulkAction: async (action) => {
          const preview = await ${ns}.preview_${safePageId}_bulk(action);
          return {
            status: "waiting_confirmation",
            summary: \`Prepared destructive bulk action for \${preview.count} rows on ${page.title}.\`,
            highlightComponentId: ${JSON.stringify(page.capabilities.find((item) => item.kind === "confirmation")?.id)},
            confirmation: {
              title: preview.title,
              message: preview.message,
              payload: {
                actionId: preview.actionId,
                selectedIds: preview.selectedIds,
                count: preview.count,
              },
            },
          };
        },
        observe: ${ns}.observe_${safePageId}_collection,
      }`);

      runtimeBlocks.push(`confirmation: {
        getElement: ${ns}.get_${safePageId}_confirmation_element,
        confirmAction: async () => {
          const result = await ${ns}.confirm_${safePageId}_action(app);
          return {
            status: "success",
            summary: \`Confirmed action on ${page.title}.\`,
            data: result,
          };
        },
        cancelAction: ${ns}.cancel_${safePageId}_action,
        observe: ${ns}.observe_${safePageId}_confirmation,
      }`);
      }

      return `{
        ...vopConfig.pages.find((page) => page.pageId === ${JSON.stringify(page.pageId)}),
        runtime: {
          reset: ${ns}.reset_${safeName(page.pageId)},
          ${runtimeBlocks.join(",\n")}
        },
      }`;
    })
    .join(",\n");

  return `// @ts-nocheck

${imports.join("\n")}

${inlineModules}

const pageIdToRoute = ${toLiteral(pageRouteMap)};

function getCurrentPageId() {
  const path = window.location.pathname;
  const matched = Object.entries(pageIdToRoute).find(([, route]) => route === path);
  return matched?.[0] ?? "global-shell";
}

function navigateToPageId(pageId) {
  const target = pageIdToRoute[pageId] ?? "/";
  window.history.pushState({}, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function waitForPaint(delay = 80) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay);
  });
}

const app = createConfiguredRuntimeApp({
  ...vopConfig,
  pages: [
    ${runtimePages}
  ],
}, {
  getCurrentPageId,
  navigateToPageId,
  waitForPaint,
});

export const getVopRuntime = () => app.runtime;
export const buildTaskFromPlan = app.buildTaskFromPlan;
export const getCurrentVopPageId = app.getCurrentPageId;
export const navigateToVopPage = app.navigateToPageId;
export const waitForRoutePaint = app.waitForPaint;
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const absoluteConfig = path.resolve(process.cwd(), args.config);
  const outputFile = resolveOutputPath(absoluteConfig, args.out);
  const configModule = await loadTsModule(absoluteConfig);
  const rawConfig = configModule.default ?? configModule.config ?? configModule;
  const config = normalizePublicConfigForGeneration(rawConfig);

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  const relativeConfigImport = path
    .relative(path.dirname(outputFile), absoluteConfig)
    .replace(/\\/g, "/")
    .replace(/\.ts$/, "");

  const legacyGeneratedDir = path.join(path.dirname(absoluteConfig), "src", "vop", "generated");
  if (fs.existsSync(legacyGeneratedDir)) {
    fs.rmSync(legacyGeneratedDir, { recursive: true, force: true });
  }

  fs.writeFileSync(
    outputFile,
    generateRuntimeFile(
      relativeConfigImport.startsWith(".") ? relativeConfigImport : `./${relativeConfigImport}`,
      config.pages,
    ),
    "utf8",
  );
}

await main();
