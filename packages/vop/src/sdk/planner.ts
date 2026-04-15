import { createActionFromDescriptor, createTaskDefinition, getActionDescriptor } from "../runtime";
import type { VOPAction, VOPRuntimeController, VOPTaskDefinition } from "../runtime";
import { createId } from "../runtime";
import type { VOPAutomationFieldSpec, VOPConfig, VOPConfiguredPage } from "./config";

interface PlannerAction {
  pageId: string;
  actionId: string;
  payload: Record<string, unknown>;
}

interface PlannerOutput {
  intent: string;
  startPageId: string;
  actions: PlannerAction[];
}

interface PlannerRepairContext {
  prompt: string;
  currentDate: string;
}

export interface OpenCodePlannerOptions {
  baseURL: string;
  apiKey?: string;
  model: string;
  fetchImpl?: typeof fetch;
}

export interface OpenCodePlannerInput {
  prompt: string;
  currentPageId: string;
  config: VOPConfig;
}

function normalizeBaseURL(value: string) {
  const trimmed = value.trim();
  const unquoted =
    trimmed.startsWith('"') && trimmed.endsWith('"')
      ? trimmed.slice(1, -1)
      : trimmed;

  return unquoted.replace(/\/+$/, "");
}

function normalizeStringValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function stripCodeFence(text: string) {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function summarizeUnexpectedResponseBody(body: string) {
  return body
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function parsePlannerOutput(content: string): PlannerOutput {
  const parsed = JSON.parse(stripCodeFence(content)) as PlannerOutput;
  if (!parsed.startPageId || !Array.isArray(parsed.actions)) {
    throw new Error("Planner response is missing required fields.");
  }
  return parsed;
}

function buildSystemPrompt() {
  return [
    "You are a VOP task planner.",
    "Return JSON only.",
    "Output shape: {intent,startPageId,actions:[{pageId,actionId,payload}]}",
    "Use only declared pages and actions.",
    "Do not invent pageIds, actionIds, or payload keys.",
    "If navigation is needed, include the legal navigate action explicitly.",
    "High-risk actions must stay as executable actions and be handled by runtime confirmation.",
    "Field labels and aliases describe the user's language, but payload objects must use canonical field keys.",
    "For date-range fields, emit an array of exactly two YYYY-MM-DD strings.",
    "For numeric fields, emit JSON numbers without units such as % or px.",
    "For radio/select options, emit the declared option value, not the human label.",
    "Do not submit a form until the relevant required fields from the user's request have been filled.",
  ].join(" ");
}

function summarizeAutomation(config: VOPConfig["pages"][number]["automation"]) {
  if (!config) {
    return undefined;
  }

  if (config.kind === "shell") {
    return {
      kind: config.kind,
      rootSelector: config.rootSelector,
    };
  }

  if (config.kind === "table") {
    return {
      kind: config.kind,
      filters: Object.entries(config.filters).map(([key, spec]) => ({
        key,
        kind: spec.kind,
        label: spec.label ?? key,
        aliases: spec.aliases ?? [],
        required: spec.required ?? false,
        description: spec.description ?? "",
      })),
    };
  }

  return {
    kind: config.kind,
    fields: Object.entries(config.fields).map(([key, spec]) => ({
      key,
      kind: spec.kind,
      label: spec.label ?? key,
      aliases: spec.aliases ?? [],
      required: spec.required ?? false,
      description: spec.description ?? "",
      options:
        spec.options?.map((option) => ({
          label: option.label,
          value: option.value,
          aliases: option.aliases ?? [],
        })) ?? [],
    })),
  };
}

function buildUserPrompt(input: OpenCodePlannerInput) {
  return JSON.stringify(
    {
      prompt: input.prompt,
      currentPageId: input.currentPageId,
      currentDate: new Date().toISOString().slice(0, 10),
      app: input.config.app,
      navigation: input.config.navigation,
      pages: input.config.pages.map((page) => ({
        pageId: page.pageId,
        title: page.title,
        route: page.route,
        automation: summarizeAutomation(page.automation),
        actions: page.actions.map((action) => ({
          id: action.id,
          type: action.type,
          componentId: action.componentId,
          label: action.label,
          risk: action.risk,
          payloadShape: action.payloadShape ?? {},
        })),
      })),
    },
    null,
    2,
  );
}

function normalizeSemanticToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s_\-:/()（）【】[\]]+/g, "");
}

function resolveFieldKey(
  fields: Record<string, VOPAutomationFieldSpec>,
  rawKey: string,
) {
  const normalizedRawKey = normalizeSemanticToken(rawKey);

  for (const [fieldKey, fieldSpec] of Object.entries(fields)) {
    const candidates = [fieldKey, fieldSpec.label, ...(fieldSpec.aliases ?? [])].filter(Boolean) as string[];
    if (candidates.some((candidate) => normalizeSemanticToken(candidate) === normalizedRawKey)) {
      return fieldKey;
    }
  }

  return rawKey;
}

function normalizeFieldValue(fieldSpec: VOPAutomationFieldSpec, rawValue: unknown) {
  if (rawValue == null) {
    return rawValue;
  }

  if (fieldSpec.kind === "radio" && fieldSpec.options?.length) {
    const normalizedValue = normalizeSemanticToken(String(rawValue));
    const matchedOption = fieldSpec.options.find((option) =>
      [option.value, option.label, ...(option.aliases ?? [])]
        .map((candidate) => normalizeSemanticToken(String(candidate)))
        .includes(normalizedValue),
    );
    if (matchedOption) {
      return matchedOption.value;
    }
  }

  if (fieldSpec.kind === "number") {
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return rawValue;
    }
    if (typeof rawValue === "string") {
      const cleaned = rawValue.replace(/[%\s,]/g, "");
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  if (fieldSpec.kind === "date-range") {
    if (Array.isArray(rawValue)) {
      return rawValue.map((value) => String(value));
    }
    if (
      typeof rawValue === "object" &&
      rawValue !== null &&
      "start" in rawValue &&
      "end" in rawValue
    ) {
      return [
        String((rawValue as { start: unknown }).start ?? ""),
        String((rawValue as { end: unknown }).end ?? ""),
      ];
    }
  }

  return rawValue;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(baseDate: string, days: number) {
  const date = new Date(`${baseDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

function extractDateRangeFromPrompt(prompt: string, currentDate: string) {
  if (
    /从今天开始往后(?:一周|7天)/.test(prompt) ||
    /今天开始往后(?:一周|7天)/.test(prompt)
  ) {
    return [currentDate, addDays(currentDate, 7)];
  }

  if (/从今天开始往后两周|今天开始往后两周/.test(prompt)) {
    return [currentDate, addDays(currentDate, 14)];
  }

  return undefined;
}

function buildTokenCandidates(fieldKey: string, fieldSpec: VOPAutomationFieldSpec) {
  return [fieldKey, fieldSpec.label, ...(fieldSpec.aliases ?? [])]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length);
}

function extractPromptSegment(
  prompt: string,
  fieldKey: string,
  fieldSpec: VOPAutomationFieldSpec,
) {
  const tokens = buildTokenCandidates(fieldKey, fieldSpec);
  for (const token of tokens) {
    const pattern = new RegExp(
      `${escapeRegExp(token)}\\s*(?:是|填|为)?\\s*[:：]?\\s*([^,，。；;\\n]+)`,
      "i",
    );
    const matched = prompt.match(pattern);
    if (matched?.[1]) {
      return matched[1].trim();
    }
  }

  return undefined;
}

function extractFieldValueFromPrompt(
  prompt: string,
  fieldKey: string,
  fieldSpec: VOPAutomationFieldSpec,
  currentDate: string,
) {
  if (fieldSpec.kind === "date-range") {
    return extractDateRangeFromPrompt(prompt, currentDate);
  }

  if (fieldSpec.kind === "radio" && fieldSpec.options?.length) {
    const normalizedPrompt = normalizeSemanticToken(prompt);
    const matchedOption = [...fieldSpec.options]
      .sort((left, right) => {
        const leftSize = Math.max(
          left.label.length,
          left.value.length,
          ...(left.aliases ?? []).map((alias) => alias.length),
        );
        const rightSize = Math.max(
          right.label.length,
          right.value.length,
          ...(right.aliases ?? []).map((alias) => alias.length),
        );
        return rightSize - leftSize;
      })
      .find((option) =>
        [option.label, option.value, ...(option.aliases ?? [])]
          .map((candidate) => normalizeSemanticToken(String(candidate)))
          .some((candidate) => normalizedPrompt.includes(candidate)),
      );
    return matchedOption?.value;
  }

  if (fieldSpec.kind === "number") {
    const tokens = buildTokenCandidates(fieldKey, fieldSpec);
    for (const token of tokens) {
      const pattern = new RegExp(
        `${escapeRegExp(token)}[^\\d]{0,8}(\\d+(?:\\.\\d+)?)\\s*%?`,
        "i",
      );
      const matched = prompt.match(pattern);
      if (matched?.[1]) {
        return Number(matched[1]);
      }
    }
    return undefined;
  }

  return extractPromptSegment(prompt, fieldKey, fieldSpec);
}

function normalizePlannerPayload(
  page: VOPConfiguredPage,
  payload: Record<string, unknown>,
  context?: PlannerRepairContext,
) {
  if (!page.automation || page.automation.kind !== "form") {
    return payload;
  }

  const normalizedPayload: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(payload)) {
    const fieldKey = resolveFieldKey(page.automation.fields, rawKey);
    const fieldSpec = page.automation.fields[fieldKey];
    normalizedPayload[fieldKey] = fieldSpec
      ? normalizeFieldValue(fieldSpec, rawValue)
      : rawValue;
  }

  if (context) {
    for (const [fieldKey, fieldSpec] of Object.entries(page.automation.fields)) {
      const existingValue = normalizedPayload[fieldKey];
      const isMissing =
        existingValue === undefined ||
        existingValue === null ||
        existingValue === "" ||
        (Array.isArray(existingValue) && existingValue.length === 0);
      if (!isMissing) {
        continue;
      }

      const extractedValue = extractFieldValueFromPrompt(
        context.prompt,
        fieldKey,
        fieldSpec,
        context.currentDate,
      );

      if (extractedValue !== undefined) {
        normalizedPayload[fieldKey] = normalizeFieldValue(fieldSpec, extractedValue);
      }
    }
  }

  return normalizedPayload;
}

function resolvePlannerAction(
  config: VOPConfig,
  page: VOPConfiguredPage,
  actionId: string,
) {
  try {
    return {
      descriptor: getActionDescriptor(
        {
          pageId: page.pageId,
          title: page.title,
          route: page.route,
          capabilities: page.capabilities,
          actions: page.actions,
          observations: page.observations,
        },
        actionId,
      ),
      ownerPage: page,
    };
  } catch (error) {
    const fallbackMatches = config.pages.filter((candidate) =>
      candidate.actions.some((action) => action.id === actionId),
    );

    if (fallbackMatches.length === 1) {
      const ownerPage = fallbackMatches[0];
      return {
        descriptor: getActionDescriptor(
          {
            pageId: ownerPage.pageId,
            title: ownerPage.title,
            route: ownerPage.route,
            capabilities: ownerPage.capabilities,
            actions: ownerPage.actions,
            observations: ownerPage.observations,
          },
          actionId,
        ),
        ownerPage,
      };
    }

    if (fallbackMatches.length > 1) {
      throw new Error(
        `Action descriptor ${actionId} is ambiguous across pages: ${fallbackMatches
          .map((candidate) => candidate.pageId)
          .join(", ")}.`,
      );
    }

    throw error;
  }
}

function plannerOutputToTask(
  config: VOPConfig,
  output: PlannerOutput,
  context: PlannerRepairContext,
): VOPTaskDefinition {
  const pageById = new Map(config.pages.map((page) => [page.pageId, page]));

  const actions = output.actions.map((step) => {
    const page = pageById.get(step.pageId);
    if (!page) {
      throw new Error(`Planner referenced unknown page: ${step.pageId}`);
    }
    const { descriptor, ownerPage } = resolvePlannerAction(config, page, step.actionId);
    return createActionFromDescriptor(
      descriptor,
      normalizePlannerPayload(ownerPage, step.payload ?? {}, context),
    ) as VOPAction;
  });

  return createTaskDefinition(
    output.startPageId,
    {
      id: createId("intent"),
      text: output.intent,
    },
    actions,
  );
}

export function createOpenCodePlanner(options: OpenCodePlannerOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseURL = normalizeBaseURL(options.baseURL);
  const model = normalizeStringValue(options.model);

  return async (input: OpenCodePlannerInput) => {
    if (
      !baseURL.startsWith("http://") &&
      !baseURL.startsWith("https://") &&
      !baseURL.startsWith("/")
    ) {
      throw new Error(
        `Planner baseURL must be absolute or same-origin relative. Received: ${options.baseURL}`,
      );
    }
    if (!model) {
      throw new Error("Planner model must be non-empty.");
    }

    const response = await fetchImpl(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey ?? "token-unused"}`,
      },
      body: JSON.stringify({
        model,
        chat_template_kwargs: {
          enable_thinking: false,
        },
        max_tokens: 512,
        response_format: {
          type: "json_object",
        },
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(),
          },
          {
            role: "user",
            content: buildUserPrompt(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      const contentType = response.headers.get("content-type") ?? "unknown";
      const summary = summarizeUnexpectedResponseBody(responseText);
      throw new Error(
        `Planner request failed with status ${response.status}. content-type=${contentType}. body=${summary}`,
      );
    }

    const responseText = await response.text();
    let data: {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    try {
      data = JSON.parse(responseText) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };
    } catch {
      const contentType = response.headers.get("content-type") ?? "unknown";
      const summary = summarizeUnexpectedResponseBody(responseText);
      throw new Error(
        `Planner returned non-JSON content. Check the planner baseURL or dev proxy. content-type=${contentType}. body=${summary}`,
      );
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Planner response did not contain message content.");
    }

    const output = parsePlannerOutput(content);
    return {
      conversationKey:
        output.actions.find((action) => action.pageId !== "global-shell")?.pageId ??
        output.startPageId,
      task: plannerOutputToTask(input.config, output, {
        currentDate: new Date().toISOString().slice(0, 10),
        prompt: input.prompt,
      }),
    };
  };
}

export function createOpenCodeRuntimePlanner(
  config: VOPConfig,
  getCurrentPageId: () => string,
  options: OpenCodePlannerOptions,
) {
  const planner = createOpenCodePlanner(options);
  return async (prompt: string) =>
    planner({
      config,
      currentPageId: getCurrentPageId(),
      prompt,
    });
}

export function createConfiguredAssistantBindings(
  config: VOPConfig,
  runtime: VOPRuntimeController,
  getCurrentPageId: () => string,
) {
  const planner = createOpenCodeRuntimePlanner(config, getCurrentPageId, {
    apiKey: config.planner?.apiKey ?? "token-unused",
    baseURL: config.planner?.baseURL ?? "",
    model: config.planner?.model ?? "",
  });

  return {
    runtime,
    buildPlan: planner,
    conversations:
      config.assistant?.conversations?.map((item) => ({
        ...item,
      })) ?? [],
    defaultPrompt: config.assistant?.defaultPrompt ?? "",
    suggestedPrompts: config.assistant?.suggestedPrompts ?? [],
    subtitle: config.assistant?.subtitle,
    title: config.assistant?.title,
    welcomeMessage: config.assistant?.welcomeMessage ?? "",
  };
}
