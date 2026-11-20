/** Tedarikçinin yüklediği kanıt belgeleri: boyut ve içerik (magic byte) doğrulaması. Saf fonksiyonlar. */
export const MAX_EVIDENCE_BYTES = 3 * 1024 * 1024;
export const MAX_EVIDENCE_FILES = 5;

export const EVIDENCE_KINDS = ["iso27001", "pentest", "soc2", "diger"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export function sniffMime(buf: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

export function safeFileName(n: unknown): string {
  const base = typeof n === "string" ? n.split(/[\\/]/).pop() ?? "" : "";
  const cleaned = base.replace(/[^\w.\- ()çğıöşüÇĞİÖŞÜ]/g, "_").trim().slice(0, 100);
  return cleaned || "belge";
}

export function validateEvidence(raw: unknown): { ok: true; fileName: string; kind: EvidenceKind; mime: string; data: Buffer } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Geçersiz istek" };
  const o = raw as Record<string, unknown>;
  const kind = (EVIDENCE_KINDS as readonly string[]).includes(String(o["kind"])) ? (o["kind"] as EvidenceKind) : "diger";
  if (typeof o["dataBase64"] !== "string" || !o["dataBase64"]) return { ok: false, error: "Dosya içeriği yok" };
  if (o["dataBase64"].length > Math.ceil(MAX_EVIDENCE_BYTES * 4 / 3) + 8) return { ok: false, error: "Dosya 3 MB sınırını aşıyor" };
  const data = Buffer.from(o["dataBase64"], "base64");
  if (!data.length) return { ok: false, error: "Dosya boş" };
  if (data.length > MAX_EVIDENCE_BYTES) return { ok: false, error: "Dosya 3 MB sınırını aşıyor" };
  const mime = sniffMime(data);
  if (!mime) return { ok: false, error: "Yalnızca PDF, PNG veya JPG yüklenebilir" };
  return { ok: true, fileName: safeFileName(o["fileName"]), kind, mime, data };
}
