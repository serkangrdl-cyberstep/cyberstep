/**
 * SOC event bus indirection.
 *
 * The triage/playbook/escalation engine emits real-time events, but must not
 * import the WebSocket server directly (it boots later, after `server.listen`).
 * The WS layer registers a broadcaster here at init; engine code calls
 * `emitSOC()` regardless of whether a broadcaster is connected yet.
 *
 * Shared WS contract — event names used by both backend and frontend:
 *   new_alert, case_created, case_updated, case_closed,
 *   sla_warning, escalation, playbook_progress
 */

export type SOCEventType =
  | "new_alert"
  | "case_created"
  | "case_updated"
  | "case_closed"
  | "sla_warning"
  | "escalation"
  | "playbook_progress";

export interface SOCEvent {
  type: SOCEventType;
  customerId?: number | null;
  caseId?: number;
  data?: Record<string, unknown>;
  ts: string;
}

type Broadcaster = (event: SOCEvent) => void;

let broadcaster: Broadcaster | null = null;

export function registerSOCBroadcaster(fn: Broadcaster): void {
  broadcaster = fn;
}

export function emitSOC(event: Omit<SOCEvent, "ts">): void {
  if (!broadcaster) return;
  try {
    broadcaster({ ...event, ts: new Date().toISOString() });
  } catch {
    /* never let a broadcast failure break the engine */
  }
}
