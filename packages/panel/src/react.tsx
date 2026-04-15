import React, { useEffect, useMemo, useState } from "react";
import type { VOPRuntimeController } from "@futelab/vop-internal-runtime";
import type { AssistantMessage, AssistantStep, VopAssistantPlan } from "./types";

export interface VopSuggestedPrompt {
  key: string;
  icon?: React.ReactNode;
  label: string;
}

export interface VopAssistantProps {
  runtime: VOPRuntimeController;
  title?: string;
  subtitle?: string;
  defaultPrompt: string;
  welcomeMessage: string;
  suggestedPrompts: VopSuggestedPrompt[];
  conversations: Array<{
    key: string;
    icon?: React.ReactNode;
    label: React.ReactNode;
    group?: string;
  }>;
  buildPlan: (prompt: string) => Promise<VopAssistantPlan> | VopAssistantPlan;
}

export type { VopAssistantPlan } from "./types";

function useRuntimeSnapshot(runtime: VOPRuntimeController) {
  return React.useSyncExternalStore(
    runtime.subscribe.bind(runtime),
    runtime.getState.bind(runtime),
    runtime.getState.bind(runtime),
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

const VOP_UI_STYLE_ID = "vop-sdk-ui-style";

function ensureVopUiStyles() {
  if (typeof document === "undefined" || document.getElementById(VOP_UI_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = VOP_UI_STYLE_ID;
  style.textContent = `
    .vop-ui-fab {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 1001;
      border: none;
      border-radius: 999px;
      padding: 14px 18px;
      background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
      color: white;
      font-weight: 600;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28);
      cursor: pointer;
    }

    .vop-ui-panel {
      position: fixed;
      right: 24px;
      top: 88px;
      bottom: 24px;
      width: 620px;
      z-index: 1000;
      pointer-events: none;
    }

    .vop-ui-panel > * {
      pointer-events: auto;
    }

    .vop-ui-card {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      height: 100%;
      border-radius: 24px;
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background:
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 30%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.95) 100%);
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18);
      backdrop-filter: blur(20px);
    }

    .vop-ui-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 18px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      background: rgba(255, 255, 255, 0.76);
    }

    .vop-ui-head-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .vop-ui-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563eb 0%, #06b6d4 100%);
      color: white;
      font-weight: 700;
    }

    .vop-ui-head-copy {
      display: grid;
      min-width: 0;
    }

    .vop-ui-head-copy strong {
      font-size: 15px;
    }

    .vop-ui-head-copy span {
      font-size: 12px;
      color: #64748b;
    }

    .vop-ui-head-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .vop-ui-pill {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: rgba(59, 130, 246, 0.12);
      color: #1d4ed8;
    }

    .vop-ui-close {
      border: none;
      background: transparent;
      color: #475569;
      cursor: pointer;
      font-size: 18px;
      padding: 4px 8px;
    }

    .vop-ui-body {
      display: grid;
      grid-template-columns: 188px minmax(0, 1fr);
      gap: 18px;
      min-height: 0;
      padding: 14px;
    }

    .vop-ui-sidebar {
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      gap: 12px;
      min-height: 0;
      padding: 10px;
      border-radius: 18px;
      background: rgba(249, 251, 255, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }

    .vop-ui-conversations {
      display: grid;
      gap: 8px;
      overflow: auto;
      align-content: start;
    }

    .vop-ui-conversation {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      text-align: left;
      border: 1px solid rgba(148, 163, 184, 0.12);
      background: white;
      border-radius: 14px;
      padding: 10px 12px;
      cursor: pointer;
    }

    .vop-ui-conversation.active {
      border-color: rgba(37, 99, 235, 0.26);
      background: rgba(37, 99, 235, 0.06);
    }

    .vop-ui-conversation-copy {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .vop-ui-conversation-copy strong {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .vop-ui-conversation-copy span {
      font-size: 11px;
      color: #64748b;
    }

    .vop-ui-meta {
      display: grid;
      gap: 8px;
    }

    .vop-ui-main {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: 12px;
      min-height: 0;
    }

    .vop-ui-block {
      padding: 14px 16px;
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.86);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }

    .vop-ui-scroll-stack {
      display: grid;
      grid-template-rows: minmax(180px, 1fr) minmax(180px, 0.9fr);
      gap: 12px;
      min-height: 0;
    }

    .vop-ui-messages,
    .vop-ui-steps {
      min-height: 0;
      overflow: auto;
      padding: 14px 16px;
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.12);
      background: linear-gradient(180deg, rgba(248, 250, 255, 0.96) 0%, rgba(255, 255, 255, 0.92) 100%);
    }

    .vop-ui-message {
      display: grid;
      gap: 6px;
      padding: 12px 14px;
      border-radius: 16px;
      margin-bottom: 10px;
      background: rgba(255, 255, 255, 0.94);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }

    .vop-ui-message.user {
      background: rgba(15, 23, 42, 0.04);
    }

    .vop-ui-message-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }

    .vop-ui-prompts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .vop-ui-prompt {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 999px;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.95);
      cursor: pointer;
      font-size: 12px;
    }

    .vop-ui-step {
      display: grid;
      gap: 4px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }

    .vop-ui-step:last-child {
      border-bottom: none;
    }

    .vop-ui-step-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .vop-ui-step-status {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #64748b;
    }

    .vop-ui-sender {
      position: sticky;
      bottom: 0;
      padding: 8px 0 0;
      background: linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(244,248,255,0.92) 28%);
    }

    .vop-ui-textarea {
      width: 100%;
      min-height: 104px;
      resize: vertical;
      border-radius: 16px;
      border: 1px solid rgba(148, 163, 184, 0.24);
      padding: 12px 14px;
      font: inherit;
      background: white;
    }

    .vop-ui-submit {
      margin-top: 10px;
      border: none;
      border-radius: 14px;
      padding: 10px 14px;
      background: linear-gradient(135deg, #111827 0%, #1f2937 100%);
      color: white;
      font-weight: 600;
      cursor: pointer;
    }

    .vop-ui-dialog-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.36);
      z-index: 1200;
      display: grid;
      place-items: center;
      padding: 24px;
    }

    .vop-ui-dialog {
      width: min(420px, 100%);
      padding: 20px;
      border-radius: 20px;
      background: white;
      border: 1px solid rgba(15, 23, 42, 0.08);
      box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22);
      display: grid;
      gap: 14px;
    }

    .vop-ui-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .vop-highlight-overlay {
      position: fixed;
      pointer-events: none;
      z-index: 1100;
      border-radius: 16px;
      border: 2px solid rgba(37, 99, 235, 0.92);
      box-shadow:
        0 0 0 9999px rgba(15, 23, 42, 0.06),
        0 18px 44px rgba(37, 99, 235, 0.18);
      background: rgba(59, 130, 246, 0.08);
      animation: vop-highlight-pulse 1.4s ease-in-out infinite;
      transition:
        top 160ms ease,
        left 160ms ease,
        width 160ms ease,
        height 160ms ease;
    }

    .vop-highlight-label {
      position: absolute;
      top: -12px;
      left: 12px;
      transform: translateY(-100%);
      border-radius: 999px;
      padding: 6px 10px;
      background: rgba(15, 23, 42, 0.92);
      color: white;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
      white-space: nowrap;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
    }

    @keyframes vop-highlight-pulse {
      0% {
        transform: scale(0.995);
        box-shadow:
          0 0 0 9999px rgba(15, 23, 42, 0.04),
          0 18px 44px rgba(37, 99, 235, 0.12);
      }

      50% {
        transform: scale(1.002);
        box-shadow:
          0 0 0 9999px rgba(15, 23, 42, 0.08),
          0 22px 52px rgba(37, 99, 235, 0.24);
      }

      100% {
        transform: scale(0.995);
        box-shadow:
          0 0 0 9999px rgba(15, 23, 42, 0.04),
          0 18px 44px rgba(37, 99, 235, 0.12);
      }
    }

    @media (max-width: 900px) {
      .vop-ui-panel {
        left: 16px;
        right: 16px;
        width: auto !important;
      }

      .vop-ui-body {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

export const VopAssistant: React.FC<VopAssistantProps> = ({
  runtime,
  title = "VOP Copilot",
  subtitle = "Route-aware assistant",
  defaultPrompt,
  welcomeMessage,
  suggestedPrompts,
  conversations,
  buildPlan,
}) => {
  ensureVopUiStyles();
  const snapshot = useRuntimeSnapshot(runtime);
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [steps, setSteps] = useState<AssistantStep[]>([]);
  const [activeConversation, setActiveConversation] = useState("current-task");
  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content: welcomeMessage,
    },
  ]);

  function markStep(key: string, patch: Partial<AssistantStep>) {
    setSteps((current) =>
      current.map((step) =>
        step.key === key
          ? {
              ...step,
              ...patch,
            }
          : step,
      ),
    );
  }

  async function runPrompt(nextPrompt: string) {
    setPlannerError(null);
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: nextPrompt,
      },
    ]);

    try {
      const plan = await buildPlan(nextPrompt);
      runtime.resetSession();
      setActiveConversation(plan.conversationKey ?? "current-task");
      setSteps(
        plan.task.actions.map((action) => ({
          key: action.id,
          title: action.label,
          description: "Waiting to run",
          status: "abort",
        })),
      );
      await runtime.startTask(plan.task);

      for (const action of plan.task.actions) {
        markStep(action.id, {
          status: "loading",
          description: "Running and highlighting target area",
        });
        await sleep(650);

        const result = await runtime.dispatchAction(action);
        const nextStatus = result.status === "waiting_confirmation" ? "loading" : "success";
        setMessages((current) => [
          ...current,
          {
            id: `assistant-step-${action.id}`,
            role: "assistant",
            content: `${action.label}: ${result.summary}`,
          },
        ]);
        markStep(action.id, {
          status: nextStatus,
          description:
            result.status === "waiting_confirmation"
              ? "Waiting for user confirmation"
              : result.summary,
        });

        if (result.status === "waiting_confirmation") {
          return;
        }

        await sleep(1200);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Planner failed to generate a valid VOP task.";
      setPlannerError(message);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: message,
        },
      ]);
    }
  }

  return (
    <>
      <button className="vop-ui-fab" onClick={() => setOpen(true)} type="button">
        VOP
      </button>

      {open ? (
        <div className="vop-ui-panel">
          <div className="vop-ui-card">
            <div className="vop-ui-head">
              <div className="vop-ui-head-title">
                <div className="vop-ui-badge">V</div>
                <div className="vop-ui-head-copy">
                  <strong>{title}</strong>
                  <span>{subtitle}</span>
                </div>
              </div>
              <div className="vop-ui-head-actions">
                <span className="vop-ui-pill">{snapshot.task?.status ?? "idle"}</span>
                <button className="vop-ui-close" onClick={() => setOpen(false)} type="button">
                  ×
                </button>
              </div>
            </div>

            <div className="vop-ui-body">
              <div className="vop-ui-sidebar">
                <div className="vop-ui-conversations">
                  {conversations.map((conversation) => (
                    <button
                      className={`vop-ui-conversation ${activeConversation === conversation.key ? "active" : ""}`}
                      key={conversation.key}
                      onClick={() => {
                        setActiveConversation(conversation.key);
                        const matched = suggestedPrompts.find((item) => item.key === conversation.key);
                        if (matched) {
                          setPrompt(matched.label);
                        }
                      }}
                      type="button"
                    >
                      <span>{conversation.icon ?? "•"}</span>
                      <span className="vop-ui-conversation-copy">
                        <strong>{conversation.label}</strong>
                        <span>{conversation.group ?? "Conversation"}</span>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="vop-ui-meta">
                  <span className="vop-ui-pill">step-by-step execution</span>
                  <span className="vop-ui-pill">runtime timeline</span>
                  {snapshot.pendingConfirmation ? (
                    <span className="vop-ui-pill">waiting confirmation</span>
                  ) : null}
                </div>
              </div>

              <div className="vop-ui-main">
                <div className="vop-ui-block">
                  <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>Global AI entry</p>
                  <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 12 }}>
                    Current highlight target: {snapshot.highlightedComponentId ?? "none"}
                  </p>
                </div>

                <div className="vop-ui-block">
                  <div className="vop-ui-prompts">
                    {suggestedPrompts.map((item) => (
                      <button
                        className="vop-ui-prompt"
                        key={item.key}
                        onClick={() => setPrompt(item.label)}
                        type="button"
                      >
                        {item.icon ?? "•"}
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {plannerError ? (
                  <div className="vop-ui-block">
                    <div style={{ color: "#b91c1c", fontSize: 13 }}>{plannerError}</div>
                  </div>
                ) : null}

                <div className="vop-ui-scroll-stack">
                  <div className="vop-ui-messages">
                    {messages.map((message) => (
                      <div className={`vop-ui-message ${message.role}`} key={message.id}>
                        <div className="vop-ui-message-label">
                          {message.role === "assistant" ? "Assistant" : "You"}
                        </div>
                        <div>{message.content}</div>
                      </div>
                    ))}
                  </div>

                  <div className="vop-ui-steps">
                    {steps.map((step) => (
                      <div className="vop-ui-step" key={step.key}>
                        <div className="vop-ui-step-head">
                          <strong>{step.title}</strong>
                          <span className="vop-ui-step-status">{step.status}</span>
                        </div>
                        <div>{step.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="vop-ui-sender">
                  <textarea
                    className="vop-ui-textarea"
                    onChange={(event) => setPrompt(event.target.value)}
                    placeholder="Describe the task you want the VOP assistant to run"
                    value={prompt}
                  />
                  <button
                    className="vop-ui-submit"
                    onClick={() => {
                      void runPrompt(prompt);
                    }}
                    type="button"
                  >
                    Run task
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {snapshot.pendingConfirmation ? (
        <div className="vop-ui-dialog-backdrop">
          <div className="vop-ui-dialog">
            <strong>{snapshot.pendingConfirmation.title}</strong>
            <div>{snapshot.pendingConfirmation.message}</div>
            <div className="vop-ui-dialog-actions">
              <button
                className="vop-ui-prompt"
                onClick={() => {
                  void runtime.cancelPendingAction();
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="vop-ui-submit"
                onClick={() => {
                  void runtime.confirmPendingAction();
                }}
                type="button"
              >
                Confirm action
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export const VopHighlight: React.FC<{
  runtime: VOPRuntimeController;
}> = ({ runtime }) => {
  ensureVopUiStyles();
  const snapshot = useRuntimeSnapshot(runtime);

  useEffect(() => {
    if (snapshot.pendingConfirmation) {
      return;
    }

    const component = snapshot.components.find(
      (item) => item.id === snapshot.highlightedComponentId,
    );
    const element = component?.getElement?.() ?? null;

    if (!element) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "vop-highlight-overlay";

    const label = document.createElement("div");
    label.className = "vop-highlight-label";
    label.textContent = component?.label ?? component?.id ?? "VOP target";
    overlay.appendChild(label);
    document.body.appendChild(overlay);

    const syncOverlay = () => {
      const rect = element.getBoundingClientRect();
      overlay.style.top = `${rect.top - 6}px`;
      overlay.style.left = `${rect.left - 6}px`;
      overlay.style.width = `${rect.width + 12}px`;
      overlay.style.height = `${rect.height + 12}px`;
    };

    syncOverlay();
    const onViewportChange = () => syncOverlay();
    window.addEventListener("scroll", onViewportChange, true);
    window.addEventListener("resize", onViewportChange);

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });

    return () => {
      window.removeEventListener("scroll", onViewportChange, true);
      window.removeEventListener("resize", onViewportChange);
      overlay.remove();
    };
  }, [snapshot.components, snapshot.highlightedComponentId, snapshot.pendingConfirmation]);

  return null;
};
