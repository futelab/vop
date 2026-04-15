import type { VOPAuditEntry } from "./runtime-types";
import { createId, nowIso } from "./utils";

const STORAGE_KEY = "vop.audit.logs";

export class AuditLogger {
  private logs: VOPAuditEntry[] = [];

  constructor() {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as VOPAuditEntry[];
      this.logs = parsed;
    } catch {
      this.logs = [];
    }
  }

  log(kind: VOPAuditEntry["kind"], payload: Record<string, unknown>) {
    const entry: VOPAuditEntry = {
      id: createId("audit"),
      kind,
      timestamp: nowIso(),
      payload,
    };

    this.logs = [...this.logs, entry];
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    }
  }

  getEntries() {
    return this.logs;
  }
}
