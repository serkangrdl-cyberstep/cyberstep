/**
 * Türk kamu kaynakları ile lead zenginleştirme.
 *
 * MERSIS: Ticaret Bakanlığı şirket sicilinden yetkili adı/unvanı çeker.
 * KAP:    Kamuyu Aydınlatma Platformu'ndan borsaya kote şirket yönetici bilgisi alır.
 *
 * Her iki kaynak da public API'dir — API key gerektirmez.
 * Sonuç bulunamazsa sessizce null döndürür, hata fırlatmaz.
 *
 * Rate limit koruması: MERSIS istekleri arası 2sn beklenir.
 * Günlük maks. 50 sorgu (cron maxLeads parametresi ile kontrol edilir).
 */
import axios from "axios";
import { db } from "@workspace/db";
import { leadCandidatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const MERSIS_BASE = "https://mersis.gtb.gov.tr/portal/rest/firma/ara";
const KAP_SEARCH_BASE = "https://www.kap.org.tr/tr/api/basicSearchByName";
const KAP_MEMBER_BASE = "https://www.kap.org.tr/tr/api/memberInfo";
const UA = "Mozilla/5.0 (compatible; CyberStep-Enrichment/1.0)";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function domainToCompanySlug(domain: string): string {
  return domain.split(".")[0]!.toLowerCase();
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

// ─── MERSIS ───────────────────────────────────────────────────────────────────

export interface MersisResult {
  officerName: string | null;
  title: string | null;
}

export async function enrichFromMersis(
  companyName: string,
  _domain: string,
): Promise<MersisResult> {
  try {
    const resp = await axios.get(MERSIS_BASE, {
      params: { firmaAdi: companyName, kayitDurumu: 1 },
      headers: { "User-Agent": UA },
      timeout: 10_000,
    });

    const data = resp.data as unknown;
    const firms: Array<Record<string, unknown>> = Array.isArray(data)
      ? (data as Array<Record<string, unknown>>)
      : Array.isArray((data as Record<string, unknown>)?.data)
        ? ((data as Record<string, unknown>).data as Array<Record<string, unknown>>)
        : Array.isArray((data as Record<string, unknown>)?.firmalar)
          ? ((data as Record<string, unknown>).firmalar as Array<Record<string, unknown>>)
          : [];

    if (firms.length === 0) return { officerName: null, title: null };

    const first = firms[0]!;

    // yetkiliListesi veya yetkililer alanından yetkili bul
    const officerList: Array<Record<string, unknown>> = Array.isArray(first.yetkiliListesi)
      ? (first.yetkiliListesi as Array<Record<string, unknown>>)
      : Array.isArray(first.yetkililer)
        ? (first.yetkililer as Array<Record<string, unknown>>)
        : Array.isArray(first.officers)
          ? (first.officers as Array<Record<string, unknown>>)
          : [];

    if (officerList.length > 0) {
      const o = officerList[0]!;
      const name = safeStr(o.ad ?? o.name ?? o.fullName ?? o.adSoyad ?? o.yetkiliAdi) || null;
      const title = safeStr(o.unvan ?? o.title ?? o.gorev ?? o.yetkiliUnvani) || null;
      if (name) return { officerName: name, title };
    }

    // Firmaya doğrudan bağlı yetkili alanları
    const directName = safeStr(first.yetkiliAdi ?? first.yetkiliAdSoyad ?? first.yetkiliAdı) || null;
    const directTitle = safeStr(first.yetkiliUnvani ?? first.yetkiliUnvanı) || null;
    return { officerName: directName, title: directTitle };

  } catch (err) {
    logger.debug({ err: String(err), company: companyName }, "MERSIS enrichment failed (non-fatal)");
    return { officerName: null, title: null };
  }
}

// ─── KAP ─────────────────────────────────────────────────────────────────────

export interface KapResult {
  officerName: string | null;
  email: string | null;
  title: string | null;
}

export async function enrichFromKap(companyName: string): Promise<KapResult> {
  try {
    const searchResp = await axios.get(KAP_SEARCH_BASE, {
      params: { name: companyName },
      headers: { "User-Agent": UA },
      timeout: 8_000,
    });

    const searchData = searchResp.data as unknown;
    const results: Array<Record<string, unknown>> = Array.isArray(searchData)
      ? (searchData as Array<Record<string, unknown>>)
      : Array.isArray((searchData as Record<string, unknown>)?.data)
        ? ((searchData as Record<string, unknown>).data as Array<Record<string, unknown>>)
        : [];

    if (results.length === 0) return { officerName: null, email: null, title: null };

    const memberCode = safeStr(
      results[0]!.memberOid ?? results[0]!.id ?? results[0]!.code ?? results[0]!.oid,
    );
    if (!memberCode) return { officerName: null, email: null, title: null };

    const memberResp = await axios.get(`${KAP_MEMBER_BASE}/${memberCode}`, {
      headers: { "User-Agent": UA },
      timeout: 8_000,
    });

    const memberData = memberResp.data as Record<string, unknown>;
    const members: Array<Record<string, unknown>> = Array.isArray(memberData.boardMembers)
      ? (memberData.boardMembers as Array<Record<string, unknown>>)
      : Array.isArray(memberData.yoneticiler)
        ? (memberData.yoneticiler as Array<Record<string, unknown>>)
        : Array.isArray(memberData.members)
          ? (memberData.members as Array<Record<string, unknown>>)
          : Array.isArray(memberData.executives)
            ? (memberData.executives as Array<Record<string, unknown>>)
            : [];

    if (members.length === 0) return { officerName: null, email: null, title: null };

    const first = members[0]!;
    const name = safeStr(first.name ?? first.ad ?? first.fullName ?? first.adSoyad) || null;
    const title = safeStr(first.title ?? first.unvan ?? first.position ?? first.gorev) || null;
    const rawEmail = safeStr(first.email ?? first.eposta ?? first.mail);
    const email = rawEmail.includes("@") ? rawEmail : null;

    return { officerName: name, email, title };

  } catch (err) {
    logger.debug({ err: String(err), company: companyName }, "KAP enrichment failed (non-fatal)");
    return { officerName: null, email: null, title: null };
  }
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export async function enrichLeadFromTrSources(
  leadId: number,
  domain: string,
): Promise<{ source: string | null; officerName: string | null }> {
  const slug = domainToCompanySlug(domain);
  const companyName = capitalizeFirst(slug);

  // 2sn bekle — MERSIS rate limit koruması
  await new Promise((r) => setTimeout(r, 2_000));

  // 1. MERSIS
  const mersis = await enrichFromMersis(companyName, domain);
  if (mersis.officerName) {
    await db.update(leadCandidatesTable).set({
      officerName: mersis.officerName,
      officerTitle: mersis.title,
      contactSource: "mersis",
      updatedAt: new Date(),
    }).where(eq(leadCandidatesTable.id, leadId));
    logger.info({ leadId, domain, officer: mersis.officerName }, "TR enrich: MERSIS yetkili bulundu");
    return { source: "mersis", officerName: mersis.officerName };
  }

  // 2. KAP
  const kap = await enrichFromKap(companyName);
  if (kap.officerName) {
    await db.update(leadCandidatesTable).set({
      officerName: kap.officerName,
      officerTitle: kap.title,
      ...(kap.email ? { contactEmail: kap.email } : {}),
      contactSource: "kap",
      updatedAt: new Date(),
    }).where(eq(leadCandidatesTable.id, leadId));
    logger.info({ leadId, domain, officer: kap.officerName, hasEmail: !!kap.email }, "TR enrich: KAP yetkili bulundu");
    return { source: "kap", officerName: kap.officerName };
  }

  logger.debug({ leadId, domain }, "TR enrich: MERSIS ve KAP'ta yetkili bulunamadı");
  return { source: null, officerName: null };
}
