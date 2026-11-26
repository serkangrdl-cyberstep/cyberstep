import { anthropic } from "@workspace/integrations-anthropic-ai";
import { getModel } from "@workspace/ai";
import { db, kvkkBreachNoticesTable, type SalesScript } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { archiveUrl } from "./webArchive";
import { logger } from "../lib/logger";
import { logAiCost } from "./aiCostTracker";
import { kvkkGet } from "./kvkkFetch";
import { parseNoticeList, parseNoticeDetail, parseTrDate, classifyNotice } from "./kvkkNoticeParse";

const MODEL = getModel("blog");
const BASE = "https://www.kvkk.gov.tr";
const UA = "CyberStepBot/1.0 (+https://cyberstep.io; kamuya acik KVKK duyuru takibi)";
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function get(url: string): Promise<string> {
  return kvkkGet(url, { "User-Agent": UA, "Accept-Language": "tr" });
}

export function buildScriptPrompt(p: { company: string; publishedAt: string | null; summary: string; signals: string[] }): string {
  return `Sen CyberStep'in (Türkiye'de tedarikçi siber risk skorlaması; dışarıdan görülen sinyalleri puanlar, tedarikçi anketi ve aksiyon planı sunar; Netsys üzerinden satılır) satış ekibi için bir telefon görüşmesi hazırlığı yazıyorsun.

DURUM: ${p.company}, KVKK Kurumu'nun internet sitesinde ${p.publishedAt ?? "yakın tarihte"} yayımlanan kamuya açık bir veri ihlali duyurusunun konusu. Duyuru özeti (tek kaynak budur):
"""
${p.summary}
"""
Tedarikçi bağlantısı sinyalleri: ${p.signals.join(", ")}.

KESİN KURALLAR:
- Yalnızca duyuru özetindeki olgulara dayan. Duyuruda olmayan hiçbir ayrıntıyı (tedarikçinin adı, nedeni, sonucu, ceza) uydurma veya tahmin etme.
- İhlali satış kozu yapma, korkutma, suçlama veya "uyumsuzsunuz" demeye yaklaşma. Duyuru kamuya açık; bunu söylemek yeterli. Kurul'un yalnızca duyuruyu yayımlamaya karar verdiğini unutma; ceza/soruşturma ima etme.
- CyberStep'in ihlali önleyeceğini, "tam koruma" sağlayacağını, uyum garantisi vereceğini söyleme. Dışarıdan görülen sinyallerin tedarikçinin içini göstermediğini açıkça belirt.
- Önce empati ve izin iste ("kısa bir dakikanız var mı?"); amaç görüşme/pilot toplantısı ayarlamak, satış kapatmak değil.
- Türkçe, sade, kurumsal; telefonda okunabilecek kısa cümleler.

ÇIKTI: Yalnızca geçerli JSON, başka metin yok:
{"opening": "telefon açılış cümleleri (3-4 cümle)", "talkingPoints": ["3-4 konuşma maddesi"], "objections": [{"objection": "olası itiraz", "answer": "kısa yanıt"}], "emailDraft": "görüşme sonrası veya ulaşılamazsa gönderilecek kısa e-posta (konu satırı dahil)", "doNot": ["söylenmemesi gerekenler (3-4 madde)"]}
objections 3 adet olsun.`;
}

function parseScript(raw: string): SalesScript | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]) as Partial<SalesScript>;
    if (typeof j.opening !== "string" || !Array.isArray(j.talkingPoints) || typeof j.emailDraft !== "string") return null;
    return { opening: j.opening, talkingPoints: j.talkingPoints.map(String), objections: Array.isArray(j.objections) ? j.objections.map(o => ({ objection: String(o.objection), answer: String(o.answer) })) : [], emailDraft: j.emailDraft, doNot: Array.isArray(j.doNot) ? j.doNot.map(String) : [] };
  } catch { return null; }
}

export async function generateSalesScript(id: number): Promise<boolean> {
  const [n] = await db.select().from(kvkkBreachNoticesTable).where(eq(kvkkBreachNoticesTable.id, id));
  if (!n) return false;
  try {
    const message = await anthropic.messages.create({ model: MODEL, max_tokens: 3000, messages: [{ role: "user", content: buildScriptPrompt({ company: n.companyName, publishedAt: n.publishedAt, summary: n.summary, signals: n.supplierSignals ?? [] }) }] });
    logAiCost({ service: "kvkk_lead", model: MODEL, inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens, metadata: { noticeId: n.noticeId } }).catch(() => {});
    const block = message.content[0];
    const script = parseScript(block?.type === "text" ? block.text : "");
    if (!script) { logger.warn({ id }, "KVKK lead: satış metni ayrıştırılamadı"); return false; }
    await db.update(kvkkBreachNoticesTable).set({ salesScript: script, updatedAt: new Date() }).where(eq(kvkkBreachNoticesTable.id, id));
    return true;
  } catch (err) {
    logger.warn({ err: String(err).slice(0, 300), id }, "KVKK lead: satış metni üretilemedi");
    return false;
  }
}

/** Duyuru listesinin ilk sayfalarını okur, yeni duyuruları kaydeder; tedarikçi bağlantılı olanlar için lead ve satış metni üretir. */
export async function runKvkkLeadWatch(pages = 2): Promise<{ seen: number; added: number; leads: number }> {
  let seen = 0, added = 0, leads = 0;
  for (let page = 0; page < pages; page++) {
    const listHtml = await get(`${BASE}/veri-ihlali-bildirimi${page ? `/?page=${page}` : ""}`);
    const items = parseNoticeList(listHtml);
    if (!items.length) { logger.warn({ page }, "KVKK lead: liste boş, sayfa yapısı değişmiş olabilir"); break; }
    for (const it of items) {
      seen++;
      const [exists] = await db.select({ id: kvkkBreachNoticesTable.id }).from(kvkkBreachNoticesTable).where(eq(kvkkBreachNoticesTable.noticeId, it.noticeId));
      if (exists) continue;
      await sleep(1200);
      try {
        const detail = parseNoticeDetail(await get(it.url));
        if (!detail) { logger.warn({ noticeId: it.noticeId }, "KVKK lead: duyuru metni ayrıştırılamadı"); continue; }
        const cls = classifyNotice(it.company, detail.summary);
        const [row] = await db.insert(kvkkBreachNoticesTable).values({
          noticeId: it.noticeId, url: it.url, companyName: it.company,
          publishedAt: detail.publishedAt ?? parseTrDate(it.dateText), decisionNo: detail.decisionNo, affectedCount: detail.affectedCount,
          summary: detail.summary, supplierLinked: cls.supplierLinked, supplierSignals: cls.signals, isLead: cls.isLead,
        }).onConflictDoNothing().returning({ id: kvkkBreachNoticesTable.id });
        if (!row) continue;
        added++;
        const arch = await archiveUrl(it.url).catch(() => null);
        if (arch) await db.update(kvkkBreachNoticesTable).set({ archiveUrl: arch }).where(eq(kvkkBreachNoticesTable.id, row.id));
        if (cls.isLead) { leads++; await generateSalesScript(row.id); }
      } catch (err) {
        logger.warn({ err: String(err).slice(0, 200), noticeId: it.noticeId }, "KVKK lead: duyuru işlenemedi");
      }
    }
    await sleep(1200);
  }
  // Arşivi olmayan duyurular için (eski kayıtlar, geçici hatalar) her taramada en fazla 8 kopya alınır
  const unarchived = await db.select({ id: kvkkBreachNoticesTable.id, url: kvkkBreachNoticesTable.url }).from(kvkkBreachNoticesTable).where(isNull(kvkkBreachNoticesTable.archiveUrl)).limit(8);
  for (const n of unarchived) {
    const arch = await archiveUrl(n.url).catch(() => null);
    if (arch) await db.update(kvkkBreachNoticesTable).set({ archiveUrl: arch }).where(eq(kvkkBreachNoticesTable.id, n.id));
    await sleep(4000);
  }
  // Sınıflama kuralı değiştiyse henüz işlem görmemiş kayıtları yeniden değerlendir
  const pending = await db.select().from(kvkkBreachNoticesTable).where(and(eq(kvkkBreachNoticesTable.status, "new"), isNull(kvkkBreachNoticesTable.salesScript)));
  for (const n of pending) {
    const cls = classifyNotice(n.companyName, n.summary);
    if (cls.isLead !== n.isLead || cls.supplierLinked !== n.supplierLinked) {
      await db.update(kvkkBreachNoticesTable).set({ isLead: cls.isLead, supplierLinked: cls.supplierLinked, supplierSignals: cls.signals, updatedAt: new Date() }).where(eq(kvkkBreachNoticesTable.id, n.id));
    }
    if (cls.isLead) { leads++; await generateSalesScript(n.id); }
  }
  logger.info({ seen, added, leads }, "KVKK lead takibi tamamlandı");
  return { seen, added, leads };
}
