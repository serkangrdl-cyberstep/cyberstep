import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin-layout";
import { useRequireAdmin } from "@/hooks/use-admin";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";

const C = {
  bg: "#060D1A",
  bg2: "#0A1828",
  cyan: "#00C8FF",
  amber: "#F5A623",
  green: "#2ECC71",
  red: "#E03A3A",
  muted: "#8896A8",
  border: "#1A3050",
  text: "#E8EDF5",
};

const SOURCE_ICONS: Record<string, string> = {
  crtsh: "🔐",
  ct_discovery: "🔐",
  crt_sh: "🔐",
  "certstream-bridge": "📡",
  certstream: "📡",
  shodan_free: "🔍",
  shodan: "🔍",
  shodan_asn: "🗄️",
  ripe_dns: "🗺️",
  ripestat: "🗺️",
  urlscan: "🌐",
  virustotal_subdomain: "🦠",
  bgptools: "🛰️",
  netcraft: "🌍",
  censys: "🔭",
  search_dorking: "🔎",
  company_registry: "🏢",
  manual: "✏️",
  unknown: "❓",
};

const SOURCE_LABELS: Record<string, string> = {
  crtsh: "crt.sh",
  ct_discovery: "crt.sh (CT)",
  crt_sh: "crt.sh",
  "certstream-bridge": "Certstream Bridge",
  certstream: "Certstream",
  shodan_free: "Shodan (Ücretsiz)",
  shodan: "Shodan",
  shodan_asn: "Shodan ASN",
  ripe_dns: "RIPE DNS",
  ripestat: "RIPEStat",
  urlscan: "URLScan.io",
  virustotal_subdomain: "VirusTotal",
  bgptools: "BGP.Tools",
  netcraft: "Netcraft",
  censys: "Censys",
  search_dorking: "Bing Dorking",
  company_registry: "Şirket Kaydı",
  manual: "Manuel",
  unknown: "Bilinmiyor",
};

const SOURCE_COLORS: Record<string, string> = {
  "certstream-bridge": "#00C8FF",
  certstream: "#00C8FF",
  crtsh: "#F5A623",
  ct_discovery: "#F5A623",
  crt_sh: "#F5A623",
  shodan_free: "#9B59B6",
  shodan: "#9B59B6",
  shodan_asn: "#E03A3A",
  ripe_dns: "#E67E22",
  ripestat: "#E67E22",
  urlscan: "#2ECC71",
  virustotal_subdomain: "#00B4A6",
  bgptools: "#3498DB",
  netcraft: "#1ABC9C",
  censys: "#E91E63",
  search_dorking: "#FF5722",
  company_registry: "#673AB7",
  manual: "#95A5A6",
  unknown: "#7F8C8D",
};

const TLD_COLORS: Record<string, string> = {
  "com.tr": "#00C8FF",
  "net.tr": "#F5A623",
  "org.tr": "#2ECC71",
  "biz.tr": "#9B59B6",
  "edu.tr": "#E03A3A",
  "web.tr": "#E67E22",
  "gen.tr": "#1ABC9C",
  "info.tr": "#3498DB",
  other: "#7F8C8D",
};

function QualificationBar({ rate }: { rate: number }) {
  const r = Number(rate) || 0;
  const color = r >= 25 ? C.green : r >= 15 ? C.amber : C.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 72, height: 5, background: C.border,
        borderRadius: 3, overflow: "hidden", flexShrink: 0,
      }}>
        <div style={{
          width: `${Math.min(r, 100)}%`, height: "100%",
          background: color, borderRadius: 3,
          transition: "width 0.6s ease",
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 36 }}>
        %{r}
      </span>
    </div>
  );
}

function KpiCard({ label, value, color, sub }: {
  label: string; value: string | number; color: string; sub: string;
}) {
  return (
    <div style={{
      background: C.bg2, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "18px 20px",
    }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: -0.5 }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "Az önce";
  if (h < 24) return `${h} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

interface SourceRow {
  source: string;
  total_discovered: number;
  total_scanned: number;
  qualified_count: number;
  teaser_sent: number;
  avg_score: number | null;
  qualification_rate: number;
  first_seen: string | null;
  last_seen: string | null;
  discovered_last_period: number;
}

interface TrendRow { day: string; source: string; count: number; }

interface TldRow {
  tld: string; total: number;
  avg_score: number | null; qualified: number; qualification_rate: number;
}

interface Totals {
  total: number; total_qualified: number;
  overall_qualification_rate: number; active_sources: number;
}

interface EnrichmentRow {
  source: string;
  total: number;
  has_sector: number;
  has_city: number;
  has_both: number;
  sector_fill_rate: number;
  city_fill_rate: number;
}

interface DashData {
  stats: SourceRow[];
  totals: Totals;
  trend: TrendRow[];
  tldStats: TldRow[];
  enrichmentStats: EnrichmentRow[];
  period: number;
}

function formatTrendData(trend: TrendRow[]) {
  const byDay: Record<string, Record<string, number>> = {};
  trend.forEach(row => {
    const d = String(row.day).slice(0, 10);
    if (!byDay[d]) byDay[d] = {};
    byDay[d][row.source] = Number(row.count);
  });
  return Object.entries(byDay)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, sources]) => ({ day: day.slice(5), ...sources }));
}

export default function SourceDashboard() {
  useRequireAdmin();
  const [data, setData] = useState<DashData | null>(null);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin-panel/source-stats?days=${period}`, { credentials: "include" })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: DashData) => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [period]);

  const trendData = data ? formatTrendData(data.trend) : [];
  const activeSources = data
    ? [...new Set(data.trend.map(r => r.source))].filter(s => SOURCE_COLORS[s] || true)
    : [];

  const totals = data?.totals ?? { total: 0, total_qualified: 0, overall_qualification_rate: 0, active_sources: 0 };

  return (
    <AdminLayout title="Kaynak Kalite Dashboard">
      <div style={{ padding: "24px 32px", background: C.bg, minHeight: "100vh", color: C.text }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0 }}>
              Kaynak Kalite Dashboard
            </h1>
            <p style={{ fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 0 }}>
              Domain keşif kaynaklarinin performans karsilastirmasi
            </p>
          </div>
          <select
            value={period}
            onChange={e => setPeriod(Number(e.target.value))}
            style={{
              background: C.bg2, border: `1px solid ${C.border}`, color: C.text,
              padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            }}
          >
            <option value={7}>Son 7 gün</option>
            <option value={30}>Son 30 gün</option>
            <option value={90}>Son 90 gün</option>
            <option value={9999}>Tüm zamanlar</option>
          </select>
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.muted, fontSize: 15 }}>
            Yükleniyor...
          </div>
        )}

        {error && (
          <div style={{
            background: "#1A0A0A", border: `1px solid ${C.red}`,
            borderRadius: 10, padding: "14px 20px", color: C.red, marginBottom: 24,
          }}>
            Veri yüklenemedi: {error}
          </div>
        )}

        {data && !loading && (
          <>
            {/* KPI Kartlar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              <KpiCard
                label="Toplam Domain"
                value={Number(totals.total).toLocaleString("tr-TR")}
                color={C.cyan}
                sub="Tüm kaynaklar"
              />
              <KpiCard
                label="Kvalifiye Lead"
                value={Number(totals.total_qualified).toLocaleString("tr-TR")}
                color={C.amber}
                sub={`%${totals.overall_qualification_rate ?? 0} oran`}
              />
              <KpiCard
                label="Aktif Kaynak"
                value={Number(totals.active_sources)}
                color={C.green}
                sub="crt.sh, certstream..."
              />
              <KpiCard
                label="Genel Kali. Orani"
                value={`%${totals.overall_qualification_rate ?? 0}`}
                color={Number(totals.overall_qualification_rate) >= 20 ? C.green : C.amber}
                sub="Hedef: >%20"
              />
            </div>

            {/* Orta: Tablo + Trend */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 18, marginBottom: 20 }}>

              {/* Kaynak Karşılaştırma Tablosu */}
              <div style={{
                background: C.bg2, border: `1px solid ${C.border}`,
                borderRadius: 14, overflow: "hidden", minWidth: 0,
              }}>
                <div style={{
                  padding: "14px 18px", fontSize: 13, fontWeight: 700,
                  color: C.text, borderBottom: `1px solid ${C.border}`,
                }}>
                  Kaynak Karşılaştırması
                </div>
                <div style={{ overflowX: "auto" }}>
                  {/* Tablo başlıkları */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 56px 56px 56px 88px 52px",
                    padding: "8px 14px", fontSize: 11,
                    color: C.muted, borderBottom: `1px solid ${C.border}`,
                    gap: 4, minWidth: 380,
                  }}>
                    <span>Kaynak</span>
                    <span style={{ textAlign: "right" }}>Keşif</span>
                    <span style={{ textAlign: "right" }}>Tarandı</span>
                    <span style={{ textAlign: "right" }}>Kvali.</span>
                    <span>Oran</span>
                    <span style={{ textAlign: "right" }}>Son</span>
                  </div>
                  {data.stats.length === 0 && (
                    <div style={{ padding: "24px 18px", color: C.muted, fontSize: 13 }}>
                      Henüz veri yok
                    </div>
                  )}
                  {data.stats.map((row) => (
                    <div key={row.source} style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 56px 56px 56px 88px 52px",
                      padding: "10px 14px", fontSize: 12,
                      borderBottom: `1px solid ${C.border}`, gap: 4,
                      alignItems: "center", minWidth: 380,
                    }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: C.text, minWidth: 0 }}>
                        <span style={{ flexShrink: 0 }}>{SOURCE_ICONS[row.source] ?? "📌"}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {SOURCE_LABELS[row.source] ?? row.source}
                        </span>
                      </span>
                      <span style={{ textAlign: "right", color: C.cyan, fontWeight: 700 }}>
                        {Number(row.total_discovered).toLocaleString("tr-TR")}
                      </span>
                      <span style={{ textAlign: "right", color: C.muted }}>
                        {Number(row.total_scanned).toLocaleString("tr-TR")}
                      </span>
                      <span style={{ textAlign: "right", color: C.amber, fontWeight: 700 }}>
                        {Number(row.qualified_count).toLocaleString("tr-TR")}
                      </span>
                      <QualificationBar rate={Number(row.qualification_rate) || 0} />
                      <span style={{ color: C.muted, fontSize: 11, textAlign: "right" }}>
                        {timeAgo(row.last_seen)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend Grafiği */}
              <div style={{
                background: C.bg2, border: `1px solid ${C.border}`,
                borderRadius: 14, padding: "16px 18px", minWidth: 0,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
                  Günlük Keşif Trendi (Son 14 Gün)
                </div>
                {trendData.length === 0 ? (
                  <div style={{ color: C.muted, fontSize: 13, paddingTop: 40, textAlign: "center" }}>
                    Son 14 günde veri yok
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={270}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <XAxis
                        dataKey="day"
                        stroke={C.border}
                        tick={{ fill: C.muted, fontSize: 10 }}
                      />
                      <YAxis
                        stroke={C.border}
                        tick={{ fill: C.muted, fontSize: 10 }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: C.bg, border: `1px solid ${C.border}`,
                          borderRadius: 8, fontSize: 12,
                        }}
                        labelStyle={{ color: C.text }}
                        itemStyle={{ color: C.muted }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11, color: C.muted, paddingTop: 8 }}
                        formatter={(value: string) => SOURCE_LABELS[value] ?? value}
                      />
                      {activeSources.map(s => (
                        <Line
                          key={s}
                          type="monotone"
                          dataKey={s}
                          stroke={SOURCE_COLORS[s] ?? "#8896A8"}
                          strokeWidth={2}
                          dot={false}
                          name={s}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* TLD Dağılımı */}
            <div style={{
              background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "16px 18px", marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
                TLD Dağılımı
              </div>
              {data.tldStats.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13 }}>Veri yok</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                  {data.tldStats.map(tld => {
                    const rate = Number(tld.qualification_rate) || 0;
                    const color = TLD_COLORS[tld.tld] ?? C.muted;
                    const rateColor = rate >= 25 ? C.green : rate >= 15 ? C.amber : C.red;
                    return (
                      <div key={tld.tld} style={{
                        background: C.bg, border: `1px solid ${C.border}`,
                        borderRadius: 10, padding: "12px 14px",
                      }}>
                        <div style={{
                          fontSize: 14, fontWeight: 800, color,
                          marginBottom: 8, fontFamily: "monospace",
                        }}>
                          .{tld.tld}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Toplam</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                            {Number(tld.total).toLocaleString("tr-TR")}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Kvalifiye</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.amber }}>
                            {Number(tld.qualified).toLocaleString("tr-TR")}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>Ort. Skor</span>
                          <span style={{ fontSize: 12, color: C.muted }}>
                            {tld.avg_score != null ? tld.avg_score : "—"}
                          </span>
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <div style={{
                            width: "100%", height: 4, background: C.border,
                            borderRadius: 2, overflow: "hidden",
                          }}>
                            <div style={{
                              width: `${Math.min(rate, 100)}%`,
                              height: "100%", background: rateColor,
                              borderRadius: 2, transition: "width 0.6s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: 11, color: rateColor, marginTop: 4, fontWeight: 700 }}>
                            %{rate} kalifikasyon
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sektör / Şehir Zenginleştirme Oranları */}
            <div style={{
              background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "16px 18px", marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
                Sektör &amp; Şehir Zenginleştirme — Kaynak Bazlı
              </div>
              {!data.enrichmentStats || data.enrichmentStats.length === 0 ? (
                <div style={{ color: C.muted, fontSize: 13 }}>Veri yok</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  {/* Başlıklar */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 60px 80px 80px 80px 100px 100px",
                    padding: "7px 14px", fontSize: 11,
                    color: C.muted, borderBottom: `1px solid ${C.border}`,
                    gap: 8, minWidth: 600,
                  }}>
                    <span>Kaynak</span>
                    <span style={{ textAlign: "right" }}>Toplam</span>
                    <span style={{ textAlign: "right" }}>Sektörlü</span>
                    <span style={{ textAlign: "right" }}>Şehirli</span>
                    <span style={{ textAlign: "right" }}>İkisi de</span>
                    <span style={{ textAlign: "right" }}>Sektör %</span>
                    <span style={{ textAlign: "right" }}>Şehir %</span>
                  </div>
                  {data.enrichmentStats.map((row) => {
                    const secRate = Number(row.sector_fill_rate) || 0;
                    const cityRate = Number(row.city_fill_rate) || 0;
                    const secColor = secRate >= 50 ? C.green : secRate >= 20 ? C.amber : C.red;
                    const cityColor = cityRate >= 50 ? C.green : cityRate >= 20 ? C.amber : C.red;
                    return (
                      <div key={row.source} style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 60px 80px 80px 80px 100px 100px",
                        padding: "10px 14px", fontSize: 12,
                        borderBottom: `1px solid ${C.border}`, gap: 8,
                        alignItems: "center", minWidth: 600,
                      }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: C.text }}>
                          <span>{SOURCE_ICONS[row.source] ?? "📌"}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {SOURCE_LABELS[row.source] ?? row.source}
                          </span>
                        </span>
                        <span style={{ textAlign: "right", color: C.cyan, fontWeight: 700 }}>
                          {Number(row.total).toLocaleString("tr-TR")}
                        </span>
                        <span style={{ textAlign: "right", color: secColor }}>
                          {Number(row.has_sector).toLocaleString("tr-TR")}
                        </span>
                        <span style={{ textAlign: "right", color: cityColor }}>
                          {Number(row.has_city).toLocaleString("tr-TR")}
                        </span>
                        <span style={{ textAlign: "right", color: C.muted }}>
                          {Number(row.has_both).toLocaleString("tr-TR")}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <div style={{ width: 48, height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(secRate, 100)}%`, height: "100%", background: secColor, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: secColor, minWidth: 32, textAlign: "right" }}>
                            %{secRate}
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
                          <div style={{ width: 48, height: 4, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(cityRate, 100)}%`, height: "100%", background: cityColor, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: cityColor, minWidth: 32, textAlign: "right" }}>
                            %{cityRate}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Kaynak Detay Tablosu — ek sütunlar */}
            <div style={{
              background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: 14, padding: "16px 18px",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>
                Kaynak Detayları
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                      {["Kaynak", "Toplam", "Dönem Keşfi", "Tarandı", "Kvalifiye", "Oran %", "Ort. Skor", "Teaser", "İlk Görülme", "Son Görülme"].map(h => (
                        <th key={h} style={{ padding: "6px 10px", color: C.muted, fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.stats.map(row => {
                      const rate = Number(row.qualification_rate) || 0;
                      const rateColor = rate >= 25 ? C.green : rate >= 15 ? C.amber : C.red;
                      return (
                        <tr key={row.source} style={{ borderBottom: `1px solid ${C.border}` }}>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-start" }}>
                              <span>{SOURCE_ICONS[row.source] ?? "📌"}</span>
                              <span style={{ color: C.text, fontWeight: 600 }}>
                                {SOURCE_LABELS[row.source] ?? row.source}
                              </span>
                            </span>
                          </td>
                          <td style={{ padding: "8px 10px", color: C.cyan, fontWeight: 700, textAlign: "right" }}>
                            {Number(row.total_discovered).toLocaleString("tr-TR")}
                          </td>
                          <td style={{ padding: "8px 10px", color: C.text, textAlign: "right" }}>
                            {Number(row.discovered_last_period).toLocaleString("tr-TR")}
                          </td>
                          <td style={{ padding: "8px 10px", color: C.muted, textAlign: "right" }}>
                            {Number(row.total_scanned).toLocaleString("tr-TR")}
                          </td>
                          <td style={{ padding: "8px 10px", color: C.amber, fontWeight: 700, textAlign: "right" }}>
                            {Number(row.qualified_count).toLocaleString("tr-TR")}
                          </td>
                          <td style={{ padding: "8px 10px", color: rateColor, fontWeight: 700, textAlign: "right" }}>
                            %{rate}
                          </td>
                          <td style={{ padding: "8px 10px", color: C.muted, textAlign: "right" }}>
                            {row.avg_score != null ? row.avg_score : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", color: C.muted, textAlign: "right" }}>
                            {Number(row.teaser_sent).toLocaleString("tr-TR")}
                          </td>
                          <td style={{ padding: "8px 10px", color: C.muted, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>
                            {row.first_seen ? new Date(row.first_seen).toLocaleDateString("tr-TR") : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", color: C.muted, fontSize: 11, textAlign: "right", whiteSpace: "nowrap" }}>
                            {timeAgo(row.last_seen)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
