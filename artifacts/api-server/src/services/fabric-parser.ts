// Normalize FortiGate / FortiAnalyzer events arriving over HTTPS into a common shape.
// Supports three payload styles: FortiLog key=value, CEF, and JSON.

export type FabricSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface NormalizedEvent {
  rawFormat: "fortilog" | "cef" | "json" | "unknown";
  eventType: string;
  severity: FabricSeverity;
  action: string | null;
  srcIp: string | null;
  dstIp: string | null;
  dstPort: number | null;
  attackName: string | null;
  message: string | null;
  deviceName: string | null;
  deviceTime: Date | null;
  raw: Record<string, unknown>;
}

const SEVERITY_MAP: Record<string, FabricSeverity> = {
  critical: "critical", crit: "critical", emergency: "critical", alert: "critical",
  high: "high", error: "high",
  medium: "medium", warning: "medium", warn: "medium",
  low: "low", notice: "low",
  info: "info", information: "info", informational: "info", debug: "info",
};

function mapSeverity(value: unknown): FabricSeverity {
  if (value === null || value === undefined) return "info";
  const s = String(value).toLowerCase().trim();
  if (SEVERITY_MAP[s]) return SEVERITY_MAP[s]!;
  // FortiGate numeric "level"/"pri" 0-7 (syslog) or 1-5
  const n = Number(s);
  if (!Number.isNaN(n)) {
    if (n <= 1) return "critical";
    if (n <= 3) return "high";
    if (n === 4) return "medium";
    if (n <= 6) return "low";
    return "info";
  }
  return "info";
}

function firstStr(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return null;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const s = String(value);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const n = Number(s);
  if (!Number.isNaN(n)) {
    const ms = n > 1e12 ? n : n * 1000;
    const d2 = new Date(ms);
    if (!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}

// FortiLog: space-separated key=value or key="value with spaces"
function parseFortiLog(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w[\w-]*)=("([^"]*)"|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = m[1]!;
    const val = m[3] !== undefined ? m[3] : (m[4] ?? "");
    out[key] = val;
  }
  return out;
}

// CEF: CEF:Version|Vendor|Product|Version|SignatureID|Name|Severity|Extension
function parseCef(text: string): { header: Record<string, string>; ext: Record<string, string> } | null {
  const idx = text.indexOf("CEF:");
  if (idx < 0) return null;
  const body = text.slice(idx + 4);
  const parts: string[] = [];
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (ch === "\\" && body[i + 1] === "|") { cur += "|"; i++; continue; }
    if (ch === "|" && parts.length < 7) { parts.push(cur); cur = ""; continue; }
    cur += ch;
  }
  parts.push(cur);
  const [version, vendor, product, prodVersion, sigId, name, severity, extension = ""] = parts;
  const ext: Record<string, string> = {};
  const re = /(\w+)=((?:[^=\\]|\\.)*?)(?=\s+\w+=|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(extension)) !== null) {
    ext[m[1]!] = (m[2] ?? "").replace(/\\=/g, "=").replace(/\\\\/g, "\\").trim();
  }
  return {
    header: { version: version ?? "", vendor: vendor ?? "", product: product ?? "", prodVersion: prodVersion ?? "", sigId: sigId ?? "", name: name ?? "", severity: severity ?? "" },
    ext,
  };
}

function normalizeFromKv(kv: Record<string, unknown>, rawFormat: NormalizedEvent["rawFormat"]): NormalizedEvent {
  const eventType = firstStr(kv as Record<string, unknown>, ["type", "subtype", "logid", "cat", "eventtype"]) ?? "unknown";
  const severity = mapSeverity(
    firstStr(kv as Record<string, unknown>, ["severity", "level", "crlevel", "pri", "crscore"]),
  );
  return {
    rawFormat,
    eventType,
    severity,
    action: firstStr(kv as Record<string, unknown>, ["action", "act", "utmaction", "status"]),
    srcIp: firstStr(kv as Record<string, unknown>, ["srcip", "src", "sourceip", "src_ip", "attacker"]),
    dstIp: firstStr(kv as Record<string, unknown>, ["dstip", "dst", "destinationip", "dst_ip", "victim"]),
    dstPort: (() => { const p = firstStr(kv as Record<string, unknown>, ["dstport", "dpt", "destinationport"]); return p ? Number(p) || null : null; })(),
    attackName: firstStr(kv as Record<string, unknown>, ["attack", "attackname", "virus", "msg", "name", "signature", "eventname"]),
    message: firstStr(kv as Record<string, unknown>, ["msg", "logdesc", "message", "name"]),
    deviceName: firstStr(kv as Record<string, unknown>, ["devname", "devid", "dvc", "deviceExternalId", "hostname"]),
    deviceTime: toDate(firstStr(kv as Record<string, unknown>, ["eventtime", "time", "rt", "date", "_time"])),
    raw: kv as Record<string, unknown>,
  };
}

export function parseEvent(body: unknown, contentType?: string): NormalizedEvent[] {
  // JSON object or array
  if (body && typeof body === "object") {
    const arr = Array.isArray(body) ? body : [body];
    return arr.map((item) => {
      if (item && typeof item === "object") {
        // Some FortiAnalyzer forwards wrap the raw line in a field.
        const rawLine = firstStr(item as Record<string, unknown>, ["log", "raw", "message", "_raw"]);
        if (rawLine && /\w+=\S+/.test(rawLine) && Object.keys(item as object).length <= 3) {
          return parseTextLine(rawLine);
        }
        return normalizeFromKv(item as Record<string, unknown>, "json");
      }
      return parseTextLine(String(item));
    });
  }

  // String payload: could be newline-delimited
  const text = String(body ?? "");
  if (!text.trim()) return [];
  void contentType;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return lines.map(parseTextLine);
}

function parseTextLine(line: string): NormalizedEvent {
  if (line.includes("CEF:")) {
    const cef = parseCef(line);
    if (cef) {
      const kv: Record<string, unknown> = {
        ...cef.ext,
        name: cef.header.name,
        severity: cef.header.severity,
        type: cef.ext["cat"] ?? cef.header.product,
        srcip: cef.ext["src"],
        dstip: cef.ext["dst"],
        dstport: cef.ext["dpt"],
        action: cef.ext["act"],
        devname: cef.ext["deviceExternalId"] ?? cef.header.product,
      };
      const norm = normalizeFromKv(kv, "cef");
      norm.attackName = cef.header.name || norm.attackName;
      return norm;
    }
  }
  if (/\w+=\S+/.test(line)) {
    return normalizeFromKv(parseFortiLog(line), "fortilog");
  }
  // Plain text fallback
  return {
    rawFormat: "unknown",
    eventType: "unknown",
    severity: "info",
    action: null, srcIp: null, dstIp: null, dstPort: null,
    attackName: null, message: line.slice(0, 500), deviceName: null, deviceTime: null,
    raw: { line },
  };
}
