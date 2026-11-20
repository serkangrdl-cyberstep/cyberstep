import { db, domainScansTable, tprmQuestionnaireLinkTable, tprmQuestionnaireResponseTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { interpret, type Interpretation } from "./tprmInterpretation";
import type { Subprocessor } from "./subprocessors";
import { crosscheckAnswers, type Contradiction } from "./questionnaireCrosscheck";
import { TPRM_QUESTIONS } from "./tprmQuestions";

export interface VendorQuestionnaireSummary {
  status: "pending" | "completed" | "expired";
  expiresAt: string;
  completedAt: string | null;
  contactName: string | null;
  contactEmail: string | null;
  /** Tedarikçinin beyanından hesaplanan puan (0-100). Doğrulanmamıştır ve tarama skoruyla birleştirilmez. */
  selfScore: number | null;
  answers: Array<{ questionId: number; text: string; answer: "evet" | "kismen" | "hayir" }>;
  /** Taramayla doğrulanabilen sorularda beyan–bulgu çelişkileri. */
  contradictions: Array<Contradiction & { text: string }>;
  subprocessors: Subprocessor[];
  interpretation: Interpretation | null;
}

/** Tedarikçinin anket durumunu ve yanıtlarını okur; taramayla çelişen beyanları işaretler. */
export async function loadVendorQuestionnaire(vendor: { questionnaireToken: string | null; lastScanData: unknown; lastScanScore?: number | null }): Promise<VendorQuestionnaireSummary | null> {
  if (!vendor.questionnaireToken) return null;
  const [link] = await db.select().from(tprmQuestionnaireLinkTable).where(eq(tprmQuestionnaireLinkTable.token, vendor.questionnaireToken));
  if (!link) return null;
  const [resp] = await db.select().from(tprmQuestionnaireResponseTable).where(eq(tprmQuestionnaireResponseTable.linkId, link.id));
  if (!resp) {
    return {
      status: new Date() > link.expiresAt ? "expired" : "pending",
      expiresAt: link.expiresAt.toISOString(), completedAt: null, contactName: null, contactEmail: null,
      selfScore: null, answers: [], contradictions: [], subprocessors: [], interpretation: null,
    };
  }
  const raw = (resp.answers as Array<{ questionId: number; answer: "evet" | "kismen" | "hayir" }>) ?? [];
  const subprocessors = Array.isArray(resp.subprocessors) ? (resp.subprocessors as Subprocessor[]) : null;
  const textOf = new Map<number, string>(TPRM_QUESTIONS.map((q) => [q.id, q.text]));
  const scanId = vendor.lastScanData && typeof vendor.lastScanData === "object" && "scanId" in vendor.lastScanData
    ? Number((vendor.lastScanData as { scanId: unknown }).scanId) : null;
  const [scan] = scanId ? await db.select().from(domainScansTable).where(eq(domainScansTable.id, scanId)) : [];
  const contradictions = scan
    ? crosscheckAnswers(raw, {
        spfRecord: scan.spfRecord, dmarcRecord: scan.dmarcRecord,
        cveSummary: scan.cveSummary as Array<{ cveId?: string; cvssScore?: number }> | null,
        uncheckedSources: scan.uncheckedSources as string[] | null,
        hudsonEmployees: (scan.tprmExtra as { hudsonRock?: { employees?: number } | null } | null)?.hudsonRock?.employees ?? null,
        subprocessorCount: subprocessors ? subprocessors.length : null,
      }).map((c) => ({ ...c, text: textOf.get(c.questionId) ?? "" }))
    : [];
  return {
    status: "completed",
    expiresAt: link.expiresAt.toISOString(),
    completedAt: resp.completedAt.toISOString(),
    contactName: resp.supplierContactName,
    contactEmail: resp.supplierContactEmail,
    selfScore: resp.selfScore,
    answers: raw.map((a) => ({ questionId: a.questionId, text: textOf.get(a.questionId) ?? "", answer: a.answer })),
    contradictions,
    subprocessors: subprocessors ?? [],
    interpretation: interpret(raw, resp.selfScore, { scanScore: vendor.lastScanScore ?? null, contradictionCount: contradictions.length }),
  };
}
