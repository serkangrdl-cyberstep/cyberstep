import { Router } from "express";
import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { requireAdmin } from "./middleware";
import { db, siteSettingsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import { checkCronHealth } from "../../services/cronHealthMonitor";
import {
  cronGetState,
  cronGetAll,
  cronGetHistory,
  cronGetStats,
  getCronFn,
  nextCronDate,
  wrapCron,
  cronGetLimit,
} from "../../services/cronRegistry";
import type { CronState } from "../../services/cronRegistry";
import { qualifyPendingCandidates, getISOWeek } from "../../services/discoveryPipeline";
import { scanCRTSH } from "../../services/crtshScanner";
import { scanShodanFree, SHODAN_FREE_QUERIES } from "../../services/shodanDiscovery";
import { runRipeDiscovery } from "../../services/ripeDiscovery";
import { runNetcraftDiscovery } from "../../services/leadDiscovery/netcraftDiscovery";
import { runBgpToolsDiscovery } from "../../services/leadDiscovery/bgpToolsDiscovery";
export const CRON_DEFS = [
  {
    name: "ripe_dns",
    label: "RIPE DNS Keşfi",
    description: "Türkiye IPv4 prefix'lerinden reverse DNS ile yeni .tr domainleri keşfeder — API key gerektirmez",
    defaultSchedule: "0 2 * * *",
    scheduleLabel: "Her gece 02:00",
    defaultEnabled: true,
    defaultLimit: 60,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
  {
    name: "crtsh",
    label: "crt.sh Domain Keşfi",
    description: "Certificate Transparency kayıtlarından yeni TR domainleri bulur ve aday olarak kaydeder",
    defaultSchedule: "0 3 * * *",
    scheduleLabel: "Her gece 03:00",
    defaultEnabled: true,
    defaultLimit: 300,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
  {
    name: "shodan",
    label: "Shodan Pasif Keşif",
    description: "Shodan API üzerinden TR domainlerinin açık port ve servis bilgisini toplar",
    defaultSchedule: "15 4 * * *",
    scheduleLabel: "Her gece 04:15",
    defaultEnabled: true,
    defaultLimit: 100,
    requiresApiKey: "SHODAN_API_KEY",
    category: "lead-gen",
  },
  {
    name: "lead_qual",
    label: "Lead Kalifikasyon",
    description: "Bekleyen lead adaylarını puanlar, filtreler ve aktif lead havuzuna taşır",
    defaultSchedule: "0 * * * *",
    scheduleLabel: "Her saat",
    defaultEnabled: true,
    defaultLimit: 20,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
  {
    name: "netcraft_discovery",
    label: "Netcraft Domain Keşfi",
    description: "Netcraft API üzerinden Türk TLD'lerini (.com.tr vb.) sorgular — NETCRAFT_API_KEY gerekli",
    defaultSchedule: "30 5 * * *",
    scheduleLabel: "Her gece 05:30",
    defaultEnabled: true,
    defaultLimit: 100,
    requiresApiKey: "NETCRAFT_API_KEY",
    category: "lead-gen",
  },
  {
    name: "bgptools_discovery",
    label: "BGP.tools ASN Keşfi",
    description: "TR ASN prefix örneklemesi + HackerTarget reverse DNS ile .tr domainleri keşfeder — API key gerektirmez",
    defaultSchedule: "15 6 * * *",
    scheduleLabel: "Her gece 06:15",
    defaultEnabled: true,
    defaultLimit: 60,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
  {
    name: "censys_discovery",
    label: "Censys SSL Keşfi",
    description: "Censys SSL sertifika verisiyle .tr TLD'li domainleri keşfeder — CENSYS_API_KEY gerekli",
    defaultSchedule: "0 7 * * *",
    scheduleLabel: "Her gece 07:00",
    defaultEnabled: true,
    defaultLimit: 100,
    requiresApiKey: "CENSYS_API_KEY",
    category: "lead-gen",
  },
  {
    name: "search_dorking",
    label: "Bing Search Dorking",
    description: "Bing'de sektörel arama sorguları ile .tr domain keşfi — API key gerektirmez",
    defaultSchedule: "0 8 * * *",
    scheduleLabel: "Her gece 08:00",
    defaultEnabled: true,
    defaultLimit: 100,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
  {
    name: "company_registry",
    label: "Şirket Kaydı Keşfi",
    description: "OpenCorporates üzerinden Türkiye şirket kayıtlarından .tr domain keşfi — API key gerektirmez",
    defaultSchedule: "0 9 * * 1",
    scheduleLabel: "Her Pazartesi 09:00",
    defaultEnabled: true,
    defaultLimit: 500,
    requiresApiKey: null as string | null,
    category: "lead-gen",
  },
  {
    name: "blog_autopilot_mon",
    label: "Blog Otopilot (Pazartesi)",
    description: "Pazartesi 09:00'da içerik takviminden AI blog yazısı üretir ve yayınlar",
    defaultSchedule: "0 6 * * 1",
    scheduleLabel: "Pazartesi 09:00",
    defaultEnabled: true,
    defaultLimit: 1,
    requiresApiKey: null as string | null,
    category: "other",
  },
  {
    name: "blog_autopilot_thu",
    label: "Blog Otopilot (Perşembe)",
    description: "Perşembe 09:00'da içerik takviminden AI blog yazısı üretir ve yayınlar",
    defaultSchedule: "0 6 * * 4",
    scheduleLabel: "Perşembe 09:00",
    defaultEnabled: true,
    defaultLimit: 1,
    requiresApiKey: null as string | null,
    category: "other",
  },
];

// All monitored cron jobs (read-only display — not manually triggerable unless also in CRON_DEFS)
export const ALL_NIGHT_JOBS = [
  // ─── Keşif & Lead ────────────────────────────────────────────────────────────
  { name: "ripe_dns",                 label: "RIPE DNS Keşfi",                     scheduleLabel: "Her gece 02:00",         scheduleExpr: "0 2 * * *",                              category: "lead-gen"     },
  { name: "crtsh",                    label: "crt.sh Domain Keşfi",                scheduleLabel: "Her 4 saatte (03:00/07:00/11:00/15:00/19:00/23:00)", scheduleExpr: "0 */4 * * *",            category: "lead-gen"     },
  { name: "netcraft_discovery",       label: "Netcraft Domain Keşfi",              scheduleLabel: "Her gece 05:30",         scheduleExpr: "30 5 * * *",                             category: "lead-gen"     },
  { name: "bgptools_discovery",       label: "BGP.tools ASN Keşfi",               scheduleLabel: "Her gece 06:15",         scheduleExpr: "15 6 * * *",                             category: "lead-gen"     },
  { name: "censys_discovery",         label: "Censys SSL Keşfi",                   scheduleLabel: "Her gece 07:00",         scheduleExpr: "0 7 * * *",                              category: "lead-gen"     },
  { name: "search_dorking",           label: "Bing Search Dorking",                scheduleLabel: "Her gece 08:00",         scheduleExpr: "0 8 * * *",                              category: "lead-gen"     },
  { name: "company_registry",         label: "Şirket Kaydı Keşfi",                scheduleLabel: "Her Pazartesi 09:00",    scheduleExpr: "0 9 * * 1",                              category: "lead-gen"     },
  { name: "shodan",                   label: "Shodan Pasif Keşif",                 scheduleLabel: "Her gece 04:15",         scheduleExpr: "15 4 * * *",                             category: "lead-gen"     },
  { name: "lead_qual",                label: "Lead Kalifikasyon",                  scheduleLabel: "Her 5 dakika",           scheduleExpr: "*/5 * * * *",                            category: "lead-gen"     },
  { name: "scan_lead_drip",           label: "Tarama Lead Drip",                   scheduleLabel: "Her saat",               scheduleExpr: "0 * * * *",                              category: "lead-gen"     },
  { name: "free_scan_followup",       label: "Ücretsiz Tarama Takip",              scheduleLabel: "Her saat",               scheduleExpr: "0 * * * *",                              category: "lead-gen"     },
  { name: "email_sequence",           label: "Email Dizisi",                       scheduleLabel: "Her 30 dakika",          scheduleExpr: "*/30 * * * *",                           category: "lead-gen"     },
  { name: "isr_imap",                 label: "ISR IMAP Okuyucu",                   scheduleLabel: "Her 10 dakika",          scheduleExpr: "*/10 * * * *",                           category: "lead-gen"     },
  // ─── Güvenlik ─────────────────────────────────────────────────────────────────
  { name: "ct_phishing_monitor",      label: "CT Log Phishing İzleme",             scheduleLabel: "Her 4 saatte",           scheduleExpr: "0 */4 * * *",                            category: "security"     },
  { name: "attack_path_analysis",     label: "Attack Path Analizi",                scheduleLabel: "Her gece 02:30",         scheduleExpr: "30 2 * * *",                             category: "security"     },
  { name: "cloud_cspm",               label: "Cloud CSPM Tarama",                  scheduleLabel: "Her gece 03:45",         scheduleExpr: "45 3 * * *",                             category: "security"     },
  { name: "github_secrets_scan",      label: "GitHub Secrets Tarama",              scheduleLabel: "Her Pazar 05:00",        scheduleExpr: "0 5 * * 0",                              category: "security"     },
  { name: "tprm_vendor_rescan",       label: "TPRM Tedarikçi Yeniden Tarama",      scheduleLabel: "Her gece 02:00",         scheduleExpr: "0 2 * * *",                              category: "security"     },
  { name: "usom_refresh",             label: "USOM IOC Güncelleme",                scheduleLabel: "Her gece 03:15",         scheduleExpr: "15 3 * * *",                             category: "security"     },
  { name: "growth_ssl_expiry",        label: "SSL Expiry Uyarısı",                 scheduleLabel: "Her gece 22:00",         scheduleExpr: "0 22 * * *",                             category: "security"     },
  { name: "growth_cve_alert",         label: "CVE Uyarı",                          scheduleLabel: "Her gece 23:30",         scheduleExpr: "30 23 * * *",                            category: "security"     },
  { name: "growth_port_change",       label: "Port Değişiklik İzleme",             scheduleLabel: "Her Pazar 01:00",        scheduleExpr: "0 1 * * 0",                              category: "security"     },
  { name: "vulncheck_kev",            label: "VulnCheck KEV Feed",                 scheduleLabel: "Her gece 01:00",         scheduleExpr: "0 1 * * *",                              category: "security"     },
  { name: "cve_feed_check",           label: "CVE Feed Kontrolü",                  scheduleLabel: "Her 2 saatte",           scheduleExpr: "0 */2 * * *",                            category: "security"     },
  { name: "cve_customer_notification",label: "Kritik CVE Müşteri Bildirimi",       scheduleLabel: "Her 4 saatte",           scheduleExpr: "0 */4 * * *",                            category: "security"     },
  { name: "weekly_delta",             label: "Haftalık Delta Tarama",              scheduleLabel: "Her Pazartesi 08:00",    scheduleExpr: "0 8 * * 1",                              category: "security"     },
  { name: "hitl_expire",              label: "HITL Onay Zaman Aşımı",              scheduleLabel: "Her 15 dakika",          scheduleExpr: "*/15 * * * *",                           category: "security"     },
  // ─── Entegrasyonlar & Operasyon ───────────────────────────────────────────────
  { name: "servicenow_health",        label: "ServiceNow Sağlık Kontrolü",         scheduleLabel: "Her saat",               scheduleExpr: "0 * * * *",                              category: "integrations" },
  { name: "servicenow_sync",          label: "ServiceNow Çift Yönlü Senkron",      scheduleLabel: "Her 15 dakika",          scheduleExpr: "*/15 * * * *",                           category: "integrations" },
  { name: "ms365_poller",             label: "Microsoft 365 Poller",               scheduleLabel: "Her 15 dakika",          scheduleExpr: "*/15 * * * *",                           category: "integrations" },
  { name: "verification_queue",       label: "Doğrulama Kuyruğu",                  scheduleLabel: "Her saat",               scheduleExpr: "0 * * * *",                              category: "integrations" },
  { name: "noc_poll",                 label: "NOC Metrik Toplama",                 scheduleLabel: "Her 5 dakika",           scheduleExpr: "3,8,13,18,23,28,33,38,43,48,53,58 * * * *", category: "integrations" },
  { name: "noc_availability",         label: "NOC Erişilebilirlik",                scheduleLabel: "Her 5 dakika",           scheduleExpr: "4,9,14,19,24,29,34,39,44,49,54,59 * * * *", category: "integrations" },
  { name: "noc_baseline",             label: "NOC Baseline Hesaplama",             scheduleLabel: "Her saat",               scheduleExpr: "0 * * * *",                              category: "integrations" },
  { name: "noc_triage",               label: "NOC Olay Triage",                    scheduleLabel: "Her 15 dakika",          scheduleExpr: "*/15 * * * *",                           category: "integrations" },
  { name: "soc_triage",               label: "SOC Olay Triage",                    scheduleLabel: "Her 5 dakika",           scheduleExpr: "1,6,11,16,21,26,31,36,41,46,51,56 * * * *", category: "integrations" },
  { name: "soc_sla",                  label: "SOC SLA İzleme",                     scheduleLabel: "Her 5 dakika",           scheduleExpr: "2,7,12,17,22,27,32,37,42,47,52,57 * * * *", category: "integrations" },
  { name: "soc_weekly_report",        label: "SOC Haftalık Rapor",                 scheduleLabel: "Her Pazartesi 09:00",    scheduleExpr: "0 9 * * 1",                              category: "integrations" },
  { name: "soc_monthly_ai_cost",      label: "SOC Aylık AI Maliyet",               scheduleLabel: "Ayın 1'i 09:00",         scheduleExpr: "0 9 1 * *",                              category: "integrations" },
  { name: "fabric_fm_health",         label: "FortiManager Sağlık Kontrolü",       scheduleLabel: "Her gece 02:45",         scheduleExpr: "45 2 * * *",                             category: "integrations" },
  { name: "fabric_weekly_report",     label: "Fortinet Haftalık Özet",             scheduleLabel: "Her Pazartesi 08:30",    scheduleExpr: "30 8 * * 1",                             category: "integrations" },
  { name: "market_watcher",           label: "Market İzleyici",                    scheduleLabel: "Her 4 saatte",           scheduleExpr: "0 */4 * * *",                            category: "integrations" },
  { name: "intel_feeds",              label: "İstihbarat Feed'leri",               scheduleLabel: "Her 6 saatte",           scheduleExpr: "0 */6 * * *",                            category: "integrations" },
  { name: "webhook_retry",            label: "Webhook Yeniden Deneme",             scheduleLabel: "Her 10 dakika",          scheduleExpr: "*/10 * * * *",                           category: "integrations" },
  // ─── Fatura & Gelir ───────────────────────────────────────────────────────────
  { name: "subscription_renewal",     label: "Abonelik Yenileme",                  scheduleLabel: "Her gün 09:00",          scheduleExpr: "0 9 * * *",                              category: "billing"      },
  { name: "subscription_reminders",   label: "Abonelik Bitiş Hatırlatıcı",         scheduleLabel: "Her gün 10:40",          scheduleExpr: "40 10 * * *",                            category: "billing"      },
  { name: "dunning_check",            label: "Ödeme Tahsilat Takibi",              scheduleLabel: "Her gün 10:15",          scheduleExpr: "15 10 * * *",                            category: "billing"      },
  { name: "auto_invoice_generate",    label: "Otomatik Fatura Oluşturma",          scheduleLabel: "Her gün 06:00",          scheduleExpr: "0 6 * * *",                              category: "billing"      },
  { name: "ioc_credit_reset",         label: "IOC Kredi Sıfırlama",                scheduleLabel: "Ayın 1'i 08:30",         scheduleExpr: "30 8 1 * *",                             category: "billing"      },
  { name: "collection_reminder",      label: "Tahsilat Hatırlatıcı",               scheduleLabel: "Her gün 10:00",          scheduleExpr: "0 10 * * *",                             category: "billing"      },
  { name: "upsell_engine",            label: "Upsell Motoru",                      scheduleLabel: "Her gece 23:00",         scheduleExpr: "0 23 * * *",                             category: "billing"      },
  { name: "platform_cost_check",      label: "Platform Maliyet Kontrolü",          scheduleLabel: "Her gece 23:45",         scheduleExpr: "45 23 * * *",                            category: "billing"      },
  { name: "sla_breach_check",         label: "SLA İhlal Kontrolü",                 scheduleLabel: "Her gün 08:20",          scheduleExpr: "20 8 * * *",                             category: "billing"      },
  { name: "sla_proactive_warning",    label: "SLA Proaktif Uyarı",                 scheduleLabel: "Her 30 dakika",          scheduleExpr: "*/30 * * * *",                           category: "billing"      },
  // ─── Assessment & Müşteri ─────────────────────────────────────────────────────
  { name: "reminder_30day",           label: "Assessment 30-gün Hatırlatıcı",      scheduleLabel: "Her gün 09:45",          scheduleExpr: "45 9 * * *",                             category: "assessment"   },
  { name: "domain_rescan",            label: "Domain Yeniden Tarama",              scheduleLabel: "Her gün 09:30",          scheduleExpr: "30 9 * * *",                             category: "assessment"   },
  { name: "ai_quality_monitor",       label: "AI Kalite İzleme",                   scheduleLabel: "Her gün 09:30",          scheduleExpr: "30 9 * * *",                             category: "assessment"   },
  { name: "annual_report_reminder",   label: "Yıllık Rapor Hatırlatıcı",           scheduleLabel: "Ayın 1'i 09:00",         scheduleExpr: "0 9 1 * *",                              category: "assessment"   },
  { name: "demo_report_refresh",      label: "Demo Rapor Yenileme",                scheduleLabel: "Ayın 1'i 10:00",         scheduleExpr: "0 10 1 * *",                             category: "assessment"   },
  { name: "health_score",             label: "Müşteri Sağlık Skoru",               scheduleLabel: "Her gece 02:00",         scheduleExpr: "0 2 * * *",                              category: "assessment"   },
  { name: "churn_auto_intervention",  label: "Churn Otomatik Müdahale",            scheduleLabel: "Her gün 08:30",          scheduleExpr: "30 8 * * *",                             category: "assessment"   },
  { name: "customer_activation_monitor", label: "Müşteri Aktivasyon İzleyici",    scheduleLabel: "Her gün 11:00",          scheduleExpr: "0 11 * * *",                             category: "assessment"   },
  { name: "platform_smoke_test",      label: "Platform Smoke Test",                scheduleLabel: "Her saat 05.dk",         scheduleExpr: "5 * * * *",                              category: "assessment"   },
  { name: "onboarding_d3d7",          label: "Onboarding D+3/D+7 Email",           scheduleLabel: "Her gün 10:30",          scheduleExpr: "30 10 * * *",                            category: "assessment"   },
  { name: "onboarding_day1_email",    label: "Onboarding İlk Gün Email",           scheduleLabel: "Her gün 10:05",          scheduleExpr: "5 10 * * *",                             category: "assessment"   },
  // ─── İçerik & Raporlama ──────────────────────────────────────────────────────
  { name: "digest_rss_collect",       label: "Digest RSS Toplama",                 scheduleLabel: "Her gece 03:30",         scheduleExpr: "30 3 * * *",                             category: "other"        },
  { name: "digest_enrich",            label: "Digest Zenginleştirme",              scheduleLabel: "Her gece 04:00",         scheduleExpr: "0 4 * * *",                              category: "other"        },
  { name: "digest_weekly_generate",   label: "Haftalık Digest Oluşturma",          scheduleLabel: "Her Cuma 04:00",         scheduleExpr: "0 4 * * 5",                              category: "other"        },
  { name: "haftalik_bulten",          label: "Haftalık CISO Bülteni",              scheduleLabel: "Her Cuma 08:00",         scheduleExpr: "0 8 * * 5",                              category: "other"        },
  { name: "blog_autopilot_mon",       label: "Blog Otopilot (Pazartesi)",          scheduleLabel: "Her Pazartesi 09:00",    scheduleExpr: "0 6 * * 1",                              category: "other"        },
  { name: "blog_autopilot_thu",       label: "Blog Otopilot (Perşembe)",           scheduleLabel: "Her Perşembe 09:00",     scheduleExpr: "0 6 * * 4",                              category: "other"        },
  { name: "social_media_weekly",      label: "Sosyal Medya Haftalık",              scheduleLabel: "Her Pazar 17:00",        scheduleExpr: "0 17 * * 0",                             category: "other"        },
  { name: "ai_tool_monitor",          label: "AI Araç İzleme",                     scheduleLabel: "Her Pazar 02:00",        scheduleExpr: "0 2 * * 0",                              category: "other"        },
  { name: "quarterly_policy_update",  label: "Çeyreklik Politika Güncelleme",      scheduleLabel: "Çeyreklik (01.01/04/07/10 03:00)", scheduleExpr: "0 3 1 1,4,7,10 *",             category: "other"        },
  { name: "inflation_reminder",       label: "Enflasyon Fiyat Hatırlatıcısı",      scheduleLabel: "Her Pazartesi 09:30",    scheduleExpr: "30 9 * * 1",                             category: "other"        },
  { name: "price_auto_update",        label: "TÜFE Fiyat Güncelleme",              scheduleLabel: "1 Ocak 09:00",           scheduleExpr: "0 9 1 1 *",                              category: "other"        },
  { name: "market_weekly_summary",    label: "Market Haftalık Özeti",              scheduleLabel: "Her Cuma 09:00",         scheduleExpr: "0 9 * * 5",                              category: "other"        },
  { name: "ciso_board_report",        label: "CISO Yönetim Raporu",                scheduleLabel: "Her ayın 25'i 09:00",    scheduleExpr: "0 9 25 * *",                             category: "other"        },
  { name: "ciso_weekly_threat",       label: "CISO Haftalık Tehdit Briefi",        scheduleLabel: "Her Cuma 09:30",         scheduleExpr: "30 9 * * 5",                             category: "other"        },
  { name: "ciso_compliance_monthly",  label: "CISO Aylık Uyumluluk",               scheduleLabel: "Ayın 1'i 08:00",         scheduleExpr: "0 8 1 * *",                              category: "other"        },
  { name: "kvkk_data_retention",      label: "KVKK Veri Saklama Kontrolü",         scheduleLabel: "Ayın 1'i 03:00",         scheduleExpr: "0 3 1 * *",                              category: "other"        },
  { name: "kvkk_scheduled_deletion",  label: "KVKK Planlı Silme",                  scheduleLabel: "Her gece 04:30",         scheduleExpr: "30 4 * * *",                             category: "other"        },
  { name: "kvkk_deadline",            label: "KVKK 72s Deadline İzleme",           scheduleLabel: "Her 30 dakika",          scheduleExpr: "*/30 * * * *",                           category: "other"        },
  { name: "daily_db_backup",          label: "Günlük DB Yedeği",                   scheduleLabel: "Her gece 03:00",         scheduleExpr: "0 3 * * *",                              category: "other"        },
  { name: "weekly_db_backup",         label: "Haftalık DB Yedeği",                 scheduleLabel: "Her Pazar 04:00",        scheduleExpr: "0 4 * * 0",                              category: "other"        },
  { name: "daily_summary",            label: "Günlük Yönetici Özeti",              scheduleLabel: "Her gün 08:00",          scheduleExpr: "0 8 * * *",                              category: "other"        },
  { name: "daily_cron_report",        label: "Günlük Cron Raporu",                 scheduleLabel: "Her gün 07:00",          scheduleExpr: "0 7 * * *",                              category: "other"        },
  { name: "task_reminder",            label: "Görev Hatırlatıcı",                  scheduleLabel: "Her gün 08:30",          scheduleExpr: "30 8 * * *",                             category: "other"        },
  { name: "nps_send",                 label: "NPS Anketi Gönderme",                scheduleLabel: "Her Salı 11:00",         scheduleExpr: "0 11 * * 2",                             category: "other"        },
  { name: "auto_tag",                 label: "Otomatik Etiketleme",                scheduleLabel: "Her gece 03:50",         scheduleExpr: "50 3 * * *",                             category: "other"        },
];

const router = Router();

// GET /api/admin-panel/cron/status — existing CRON_DEFS + in-memory state + DB stats merged
router.get("/admin-panel/cron/status", requireAdmin, async (req: Request, res: Response) => {
  try {
    const [rows, dbStats] = await Promise.all([
      db.select().from(siteSettingsTable),
      cronGetStats(),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const r of rows) settingsMap[r.key] = r.value;

    const statsMap = Object.fromEntries(dbStats.map((s) => [s.job_name, s]));

    const jobs = CRON_DEFS.map((def) => {
      const state = cronGetState(def.name);
      const stat = statsMap[def.name];
      const nextRun = nextCronDate(def.defaultSchedule);
      return {
        name: def.name,
        label: def.label,
        description: def.description,
        scheduleLabel: def.scheduleLabel,
        scheduleExpr: def.defaultSchedule,
        category: def.category,
        requiresApiKey: def.requiresApiKey,
        apiKeyPresent: def.requiresApiKey ? !!process.env[def.requiresApiKey] : null,
        enabled: settingsMap[`cron.${def.name}.enabled`] !== "false",
        limit: parseInt(settingsMap[`cron.${def.name}.limit`] || String(def.defaultLimit)) || def.defaultLimit,
        state: {
          ...state,
          // prefer DB-persisted values for accuracy across restarts
          lastProcessedCount: stat?.last_count ?? state.lastProcessedCount,
          lastError: stat?.last_error ?? state.lastError,
        },
        dbStats: stat
          ? {
              totalRuns: Number(stat.total_runs),
              okRuns: Number(stat.ok_runs),
              errorRuns: Number(stat.error_runs),
              avgDurationMs: stat.avg_duration_ms ? Number(stat.avg_duration_ms) : null,
              lastRunAt: stat.last_run_at,
              lastStatus: stat.last_status,
            }
          : null,
        nextRunAt: nextRun?.toISOString() ?? null,
        triggerable: true,
      };
    });

    res.json({ jobs, allStates: cronGetAll() });
  } catch (e) {
    req.log.error({ err: e }, "Cron status hatası");
    res.status(500).json({ error: "Cron durumu alınamadı" });
  }
});

// GET /api/admin-panel/cron/all-jobs — all night jobs + DB stats (read-only)
router.get("/admin-panel/cron/all-jobs", requireAdmin, async (req: Request, res: Response) => {
  try {
    const dbStats = await cronGetStats();
    const statsMap = Object.fromEntries(dbStats.map((s) => [s.job_name, s]));

    const jobs = ALL_NIGHT_JOBS.map((def) => {
      const state = cronGetState(def.name);
      const stat = statsMap[def.name];
      const nextRun = nextCronDate(def.scheduleExpr);
      return {
        name: def.name,
        label: def.label,
        scheduleLabel: def.scheduleLabel,
        scheduleExpr: def.scheduleExpr,
        category: def.category,
        state: {
          ...state,
          lastProcessedCount: stat?.last_count ?? state.lastProcessedCount,
          lastError: stat?.last_error ?? state.lastError,
          lastRunStatus: (stat?.last_status as CronState["lastRunStatus"]) ?? state.lastRunStatus,
          lastRunAt: stat?.last_run_at ?? state.lastRunAt,
        },
        dbStats: stat
          ? {
              totalRuns: Number(stat.total_runs),
              okRuns: Number(stat.ok_runs),
              errorRuns: Number(stat.error_runs),
              avgDurationMs: stat.avg_duration_ms ? Number(stat.avg_duration_ms) : null,
            }
          : null,
        nextRunAt: nextRun?.toISOString() ?? null,
        triggerable: CRON_DEFS.some((d) => d.name === def.name),
      };
    });

    // Also add any DB-tracked jobs not in ALL_NIGHT_JOBS
    const knownNames = new Set(ALL_NIGHT_JOBS.map((d) => d.name));
    for (const stat of dbStats) {
      if (!knownNames.has(stat.job_name)) {
        const state = cronGetState(stat.job_name);
        jobs.push({
          name: stat.job_name,
          label: stat.job_name.replace(/_/g, " "),
          scheduleLabel: "—",
          scheduleExpr: "",
          category: "other",
          state: {
            ...state,
            lastProcessedCount: stat.last_count ?? state.lastProcessedCount,
            lastError: stat.last_error ?? state.lastError,
            lastRunStatus: (stat.last_status as CronState["lastRunStatus"]) ?? state.lastRunStatus,
            lastRunAt: stat.last_run_at ?? state.lastRunAt,
          },
          dbStats: {
            totalRuns: Number(stat.total_runs),
            okRuns: Number(stat.ok_runs),
            errorRuns: Number(stat.error_runs),
            avgDurationMs: stat.avg_duration_ms ? Number(stat.avg_duration_ms) : null,
          },
          nextRunAt: null,
          triggerable: false,
        });
      }
    }

    res.json({ jobs });
  } catch (e) {
    req.log.error({ err: e }, "All-jobs hatası");
    res.status(500).json({ error: "Job listesi alınamadı" });
  }
});

// GET /api/admin-panel/cron/health
router.get("/admin-panel/cron/health", requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await checkCronHealth();
    res.json(result);
  } catch (e) {
    req.log.error({ err: e }, "Cron health hatası");
    res.status(500).json({ error: "Sağlık durumu alınamadı" });
  }
});

// GET /api/admin-panel/cron/history?job=&limit=
router.get("/admin-panel/cron/history", requireAdmin, async (req: Request, res: Response) => {
  try {
    const job = typeof req.query["job"] === "string" ? req.query["job"] : undefined;
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query["limit"] || "50"))));
    const runs = await cronGetHistory(job, limit);
    res.json({ runs });
  } catch (e) {
    req.log.error({ err: e }, "Cron history hatası");
    res.status(500).json({ error: "Geçmiş alınamadı" });
  }
});

// PUT /api/admin-panel/cron/settings
router.put("/admin-panel/cron/settings", requireAdmin, async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      if (!key.startsWith("cron.")) { res.status(400).json({ error: "Geçersiz anahtar" }); return; }
      await db.insert(siteSettingsTable)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: siteSettingsTable.key, set: { value, updatedAt: new Date() } });
    }
    logger.info({ keys: Object.keys(updates) }, "Cron settings updated");
    res.json({ success: true });
  } catch (e) {
    req.log.error({ err: e }, "Cron settings güncelleme hatası");
    res.status(500).json({ error: "Ayarlar güncellenemedi" });
  }
});

// POST /api/admin-panel/cron/trigger/:name
router.post("/admin-panel/cron/trigger/:name", requireAdmin, async (req: Request, res: Response) => {
  const name = String(req.params["name"]);
  const def = CRON_DEFS.find((d) => d.name === name);
  if (!def) { res.status(404).json({ error: "Cron bulunamadı" }); return; }

  const state = cronGetState(name);
  if (state.isRunning) { res.status(409).json({ error: "Zaten çalışıyor" }); return; }

  const limitRows = await db.select().from(siteSettingsTable)
    .where(eq(siteSettingsTable.key, `cron.${name}.limit`))
    .catch(() => [] as { key: string; value: string }[]);
  const limitRow = limitRows[0];
  const limit = parseInt(limitRow?.value || String(def.defaultLimit)) || def.defaultLimit;

  res.json({ started: true, message: `${def.label} başlatıldı` });

  setImmediate(async () => {
    // Prefer the registered wrapCron fn for persistence
    const wrappedFn = getCronFn(name);
    if (wrappedFn) {
      await wrappedFn().catch((err: unknown) => logger.warn({ err, name }, "Manual trigger failed"));
      return;
    }

    // Fallback: inline execution with wrapCron
    const fn = wrapCron(name, def.defaultSchedule, async () => {
      if (name === "ripe_dns") {
        await runRipeDiscovery({ maxPrefixes: limit });
      } else if (name === "netcraft_discovery") {
        await runNetcraftDiscovery();
      } else if (name === "bgptools_discovery") {
        await runBgpToolsDiscovery();
      } else if (name === "crtsh") {
        await scanCRTSH("%.com.tr", { daysBack: 2, minCorporateScore: 10, limit });
        await new Promise((r) => setTimeout(r, 3000));
        await scanCRTSH("%.net.tr", { daysBack: 2, minCorporateScore: 10, limit: Math.floor(limit / 3) });
      } else if (name === "shodan") {
        if (!process.env["SHODAN_API_KEY"]) return 0;
        const queryIdx = getISOWeek(new Date()) % SHODAN_FREE_QUERIES.length;
        await scanShodanFree(queryIdx, limit);
      } else if (name === "lead_qual") {
        await qualifyPendingCandidates(limit);
      }
      return limit;
    });
    await fn().catch((err: unknown) => logger.warn({ err, name }, "Manual trigger fallback failed"));
  });
});

export default router;
