import { db, domainScansTable } from "@workspace/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AnnualReportData {
  companyName: string;
  domain: string;
  year: number;
  yearEndScore: number;
  yearEndGrade: string;
  prevYearScore: number;
  scoreDelta: number;
  totalScans: number;
  closedFindings: number;
  surfaceReduction: number;
  avgCriticalCloseDays: number;
  monthlyScores: number[];
  topAchievement: string;
  sectorPercentile: number;
}

export function gradeColor(grade: string): string {
  const map: Record<string, string> = {
    A: "#2ECC71",
    B: "#57CC6F",
    C: "#F39C12",
    D: "#E67E22",
    F: "#E03A3A",
  };
  return map[grade] ?? "#E03A3A";
}

function generateMonthlyBarsXML(scores: number[]): string {
  const monthNames = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
  const maxScore = Math.max(...scores, 1);
  const barW = 36;
  const barMaxH = 80;
  const gap = 8;
  const bars: string[] = scores.map((s, i) => {
    const h = Math.max(4, Math.round((s / maxScore) * barMaxH));
    const x = i * (barW + gap);
    const y = barMaxH - h;
    const color = s >= 80 ? "#2ECC71" : s >= 60 ? "#F39C12" : s >= 40 ? "#E67E22" : "#E03A3A";
    return [
      `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="${color}" opacity="0.85"/>`,
      `<text x="${x + barW / 2}" y="${barMaxH + 14}" text-anchor="middle" font-size="9" fill="#8899AA">${monthNames[i] ?? ""}</text>`,
      `<text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="8" fill="${color}">${s}</text>`,
    ].join("");
  });
  return bars.join("");
}

export function generateAnnualReportSvg(data: AnnualReportData): string {
  const scoreOffset = 251.2 - (data.yearEndScore / 100) * 251.2;
  const deltaStr = data.scoreDelta >= 0 ? `+${data.scoreDelta}` : `${data.scoreDelta}`;
  const deltaColor = data.scoreDelta >= 0 ? "#2ECC71" : "#E03A3A";
  const gc = gradeColor(data.yearEndGrade);
  const monthlyBars = generateMonthlyBarsXML(data.monthlyScores);

  const templatePath = path.resolve(__dirname, "../../templates/annual-report-template.svg");
  let template: string;
  try {
    template = fs.readFileSync(templatePath, "utf-8");
  } catch {
    template = buildFallbackTemplate();
  }

  return template
    .replace(/\{\{COMPANY_NAME\}\}/g, escapeXml(data.companyName))
    .replace(/\{\{DOMAIN\}\}/g, escapeXml(data.domain))
    .replace(/\{\{YEAR\}\}/g, String(data.year))
    .replace(/\{\{YEAR_END_SCORE\}\}/g, String(data.yearEndScore))
    .replace(/\{\{YEAR_END_GRADE\}\}/g, escapeXml(data.yearEndGrade))
    .replace(/\{\{GRADE_COLOR\}\}/g, gc)
    .replace(/\{\{PREV_SCORE\}\}/g, String(data.prevYearScore))
    .replace(/\{\{SCORE_DELTA\}\}/g, deltaStr)
    .replace(/\{\{DELTA_COLOR\}\}/g, deltaColor)
    .replace(/\{\{TOTAL_SCANS\}\}/g, String(data.totalScans))
    .replace(/\{\{CLOSED_FINDINGS\}\}/g, String(data.closedFindings))
    .replace(/\{\{SURFACE_RED\}\}/g, `%${data.surfaceReduction}`)
    .replace(/\{\{AVG_CLOSE_DAYS\}\}/g, String(data.avgCriticalCloseDays))
    .replace(/\{\{SECTOR_PCT\}\}/g, String(data.sectorPercentile))
    .replace(/\{\{TOP_ACHIEVEMENT\}\}/g, escapeXml(data.topAchievement))
    .replace(/\{\{SCORE_OFFSET\}\}/g, String(scoreOffset.toFixed(1)))
    .replace(/\{\{MONTHLY_BARS\}\}/g, monthlyBars);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildFallbackTemplate(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="560" viewBox="0 0 800 560">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060D1A"/>
      <stop offset="100%" stop-color="#0D1F3C"/>
    </linearGradient>
  </defs>
  <rect width="800" height="560" fill="url(#bg)"/>
  <rect x="0" y="0" width="5" height="560" fill="#00C8FF"/>

  <!-- Header -->
  <text x="32" y="52" font-family="system-ui,sans-serif" font-size="11" font-weight="700" fill="#00C8FF" letter-spacing="3">CYBERSTEP.IO</text>
  <text x="32" y="74" font-family="system-ui,sans-serif" font-size="22" font-weight="800" fill="white">{{YEAR}} Yıllık Güvenlik Raporu</text>
  <text x="32" y="96" font-family="system-ui,sans-serif" font-size="14" fill="#8899AA">{{COMPANY_NAME}} · {{DOMAIN}}</text>

  <line x1="32" y1="110" x2="768" y2="110" stroke="#00C8FF" stroke-opacity="0.15" stroke-width="1"/>

  <!-- Score ring area -->
  <circle cx="120" cy="200" r="60" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12"/>
  <circle cx="120" cy="200" r="60" fill="none" stroke="{{GRADE_COLOR}}" stroke-width="12"
    stroke-linecap="round"
    stroke-dasharray="376.99"
    stroke-dashoffset="{{SCORE_OFFSET}}"
    transform="rotate(-90 120 200)"/>
  <text x="120" y="194" text-anchor="middle" font-family="system-ui,sans-serif" font-size="28" font-weight="900" fill="white">{{YEAR_END_SCORE}}</text>
  <text x="120" y="212" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#8899AA">/100 puan</text>

  <!-- Grade -->
  <rect x="185" y="155" width="90" height="60" rx="12" fill="{{GRADE_COLOR}}" opacity="0.12"/>
  <rect x="185" y="155" width="90" height="60" rx="12" fill="none" stroke="{{GRADE_COLOR}}" stroke-opacity="0.4" stroke-width="1.5"/>
  <text x="230" y="196" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="900" fill="{{GRADE_COLOR}}">{{YEAR_END_GRADE}}</text>

  <!-- Delta -->
  <text x="300" y="175" font-family="system-ui,sans-serif" font-size="11" fill="#8899AA">Önceki yıl: {{PREV_SCORE}}</text>
  <text x="300" y="198" font-family="system-ui,sans-serif" font-size="20" font-weight="800" fill="{{DELTA_COLOR}}">{{SCORE_DELTA}}</text>
  <text x="300" y="216" font-family="system-ui,sans-serif" font-size="10" fill="#8899AA">puan değişim</text>

  <!-- Stats row -->
  <rect x="32" y="268" width="170" height="72" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <text x="117" y="298" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" font-weight="900" fill="white">{{TOTAL_SCANS}}</text>
  <text x="117" y="326" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#8899AA">Toplam Tarama</text>

  <rect x="214" y="268" width="170" height="72" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <text x="299" y="298" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" font-weight="900" fill="#2ECC71">{{CLOSED_FINDINGS}}</text>
  <text x="299" y="326" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#8899AA">Kapatılan Bulgu</text>

  <rect x="396" y="268" width="170" height="72" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <text x="481" y="298" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" font-weight="900" fill="#F39C12">%{{SECTOR_PCT}}</text>
  <text x="481" y="326" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#8899AA">Sektör Yüzdelik</text>

  <rect x="578" y="268" width="190" height="72" rx="10" fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.07)" stroke-width="1"/>
  <text x="673" y="298" text-anchor="middle" font-family="system-ui,sans-serif" font-size="26" font-weight="900" fill="#E03A3A">{{AVG_CLOSE_DAYS}}</text>
  <text x="673" y="326" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" fill="#8899AA">Ort. Kapatma Günü</text>

  <!-- Monthly bars -->
  <text x="32" y="375" font-family="system-ui,sans-serif" font-size="10" fill="#8899AA">Aylık Skor Trendi</text>
  <g transform="translate(32, 385)">{{MONTHLY_BARS}}</g>

  <!-- Top achievement -->
  <rect x="32" y="490" width="736" height="38" rx="8" fill="rgba(0,200,255,0.05)" stroke="rgba(0,200,255,0.15)" stroke-width="1"/>
  <text x="48" y="514" font-family="system-ui,sans-serif" font-size="11" fill="#00C8FF">Yılın Başarısı:</text>
  <text x="145" y="514" font-family="system-ui,sans-serif" font-size="11" fill="rgba(255,255,255,0.7)">{{TOP_ACHIEVEMENT}}</text>

  <!-- Footer -->
  <text x="400" y="548" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="rgba(255,255,255,0.15)">cyberstep.io · KOBİ'ler için Türkçe Siber Güvenlik Platformu</text>
</svg>`;
}

export function calculateMonthlyScores(
  scans: Array<{ overallScore: number; createdAt: Date | string }>,
  _year: number
): number[] {
  const months = Array<number | null>(12).fill(null);
  for (const scan of scans) {
    const month = new Date(scan.createdAt).getMonth();
    const prev = months[month];
    if (prev === null || scan.overallScore > prev) {
      months[month] = scan.overallScore;
    }
  }
  let last = 50;
  return months.map((s) => {
    if (s !== null) last = s;
    return last;
  });
}

export function detectTopAchievement(
  scans: Array<{ overallScore: number; createdAt: Date | string }>,
  year: number
): string {
  const monthly = calculateMonthlyScores(scans, year);
  let maxGain = 0;
  let bestMonth = 0;
  for (let i = 1; i < 12; i++) {
    const gain = (monthly[i] ?? 0) - (monthly[i - 1] ?? 0);
    if (gain > maxGain) {
      maxGain = gain;
      bestMonth = i;
    }
  }
  const monthNames = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
  if (maxGain > 5) return `${monthNames[bestMonth] ?? ""}'da ${maxGain} puan artış sağlandı`;
  return "Yıl boyunca tutarlı güvenlik seviyesi korundu";
}

export function calculateSectorPercentile(_sector: string | null, score: number): number {
  if (score >= 70) return 80;
  if (score >= 55) return 60;
  if (score >= 40) return 40;
  return 20;
}

export async function getActiveCustomersWithScans(year: number): Promise<Array<{
  domain: string;
  email: string | null;
  companyName: string;
  sector: string | null;
}>> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year + 1, 0, 1);

  const rows = await db
    .selectDistinctOn([domainScansTable.domain], {
      domain: domainScansTable.domain,
      email: domainScansTable.email,
      sector: domainScansTable.sector,
    })
    .from(domainScansTable)
    .where(
      and(
        gte(domainScansTable.createdAt, startOfYear),
        lt(domainScansTable.createdAt, endOfYear)
      )
    );

  return rows
    .filter((r) => !!r.email)
    .map((r) => ({
      domain: r.domain,
      email: r.email,
      companyName: r.domain,
      sector: r.sector,
    }));
}

export async function getYearScans(
  domain: string,
  year: number
): Promise<Array<{ overallScore: number; letterGrade: string | null; createdAt: Date | string }>> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year + 1, 0, 1);

  return db
    .select({
      overallScore: domainScansTable.overallScore,
      letterGrade: domainScansTable.letterGrade,
      createdAt: domainScansTable.createdAt,
    })
    .from(domainScansTable)
    .where(
      and(
        eq(domainScansTable.domain, domain),
        gte(domainScansTable.createdAt, startOfYear),
        lt(domainScansTable.createdAt, endOfYear)
      )
    )
    .orderBy(domainScansTable.createdAt);
}

export async function countClosedFindings(_domain: string, _year: number): Promise<number> {
  return 0;
}

export async function avgCriticalCloseDays(_domain: string, _year: number): Promise<number> {
  return 0;
}

export async function saveReport(pngBuffer: Buffer, filename: string): Promise<string> {
  const uploadsDir = path.resolve(process.cwd(), "uploads/annual-reports");
  fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, filename);
  fs.writeFileSync(filePath, pngBuffer);
  const domains = process.env["REPLIT_DOMAINS"];
  const baseUrl = domains ? `https://${domains.split(",")[0]?.trim()}` : "https://cyberstep.io";
  return `${baseUrl}/uploads/annual-reports/${filename}`;
}

export async function generateAnnualReports(year: number, filterDomain?: string): Promise<number> {
  const customers = await getActiveCustomersWithScans(year);
  let sent = 0;

  for (const customer of customers) {
    if (filterDomain && customer.domain !== filterDomain) continue;
    try {
      const scans = await getYearScans(customer.domain, year);
      if (!scans.length) continue;

      const lastScan = scans[scans.length - 1]!;
      const firstScan = scans[0]!;

      const reportData: AnnualReportData = {
        companyName: customer.companyName,
        domain: customer.domain,
        year,
        yearEndScore: lastScan.overallScore,
        yearEndGrade: lastScan.letterGrade ?? "F",
        prevYearScore: firstScan.overallScore,
        scoreDelta: lastScan.overallScore - firstScan.overallScore,
        totalScans: scans.length,
        closedFindings: await countClosedFindings(customer.domain, year),
        surfaceReduction: 0,
        avgCriticalCloseDays: await avgCriticalCloseDays(customer.domain, year),
        monthlyScores: calculateMonthlyScores(scans, year),
        topAchievement: detectTopAchievement(scans, year),
        sectorPercentile: calculateSectorPercentile(customer.sector, lastScan.overallScore),
      };

      const svgContent = generateAnnualReportSvg(reportData);

      const { Resvg } = await import("@resvg/resvg-js");
      const resvg = new Resvg(svgContent, { fitTo: { mode: "width", value: 800 } });
      const pngBuffer = resvg.render().asPng();
      const pdfUrl = await saveReport(Buffer.from(pngBuffer), `${customer.domain}-${year}-annual.png`);

      const { db: database, annualReportsTable } = await import("@workspace/db");
      await database.insert(annualReportsTable).values({
        domain: reportData.domain,
        companyName: reportData.companyName,
        year: reportData.year,
        yearEndScore: reportData.yearEndScore,
        yearEndGrade: reportData.yearEndGrade,
        prevYearScore: reportData.prevYearScore,
        scoreDelta: reportData.scoreDelta,
        totalScans: reportData.totalScans,
        closedFindings: reportData.closedFindings,
        surfaceReduction: reportData.surfaceReduction,
        avgCriticalCloseDays: reportData.avgCriticalCloseDays,
        monthlyScores: reportData.monthlyScores,
        topAchievement: reportData.topAchievement,
        sectorPercentile: reportData.sectorPercentile,
        svgContent,
        pdfUrl,
      });

      if (customer.email) {
        const { sendMail } = await import("../../services/email.js");
        await sendMail({
          to: customer.email,
          subject: `${reportData.companyName} — ${year} Yıllık Güvenlik Raporu`,
          html: buildAnnualReportEmail(reportData, pdfUrl),
          attachments: [
            {
              filename: `guvenlik-raporu-${year}.png`,
              content: Buffer.from(pngBuffer),
              contentType: "image/png",
            },
          ],
        });
      }

      sent++;
      await new Promise((r) => setTimeout(r, 10_000));
    } catch (err) {
      console.error(`Annual report failed for ${customer.domain}:`, err);
    }
  }

  return sent;
}

function buildAnnualReportEmail(data: AnnualReportData, pdfUrl: string): string {
  const gc = gradeColor(data.yearEndGrade);
  const deltaStr = data.scoreDelta >= 0 ? `+${data.scoreDelta}` : `${data.scoreDelta}`;
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#060D1A;color:#E8EDF5;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="color:#00C8FF;font-size:11px;font-weight:700;letter-spacing:3px;margin-bottom:8px;">CYBERSTEP.IO</div>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 4px;">${data.year} Yıllık Güvenlik Raporu</h1>
    <p style="font-size:13px;color:#8899AA;margin:0 0 24px;">${data.companyName} · ${data.domain}</p>

    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="text-align:center;">
          <div style="font-size:48px;font-weight:900;color:${gc};line-height:1;">${data.yearEndScore}</div>
          <div style="font-size:10px;color:#8899AA;">/100 puan</div>
        </div>
        <div>
          <div style="font-size:32px;font-weight:900;color:${gc};">${data.yearEndGrade} Notu</div>
          <div style="font-size:12px;color:#8899AA;">Yıl sonu güvenlik skoru</div>
          <div style="font-size:13px;margin-top:4px;color:${data.scoreDelta >= 0 ? "#2ECC71" : "#E03A3A"}">
            Yıl boyunca ${deltaStr} puan değişim
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:white;">${data.totalScans}</div>
        <div style="font-size:10px;color:#8899AA;">Toplam Tarama</div>
      </div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#F39C12;">%${data.sectorPercentile}</div>
        <div style="font-size:10px;color:#8899AA;">Sektör Yüzdelik Dilim</div>
      </div>
    </div>

    <div style="background:rgba(0,200,255,0.05);border:1px solid rgba(0,200,255,0.15);border-radius:8px;padding:14px;margin-bottom:24px;">
      <div style="font-size:10px;color:#00C8FF;margin-bottom:4px;">YILIN BASARISI</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.8);">${data.topAchievement}</div>
    </div>

    <a href="${pdfUrl}" style="display:inline-block;background:#00C8FF;color:#060D1A;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;">
      Tam Raporu Görüntüle
    </a>

    <p style="font-size:10px;color:rgba(255,255,255,0.2);margin-top:24px;">
      cyberstep.io — KOBİ'ler için Türkçe Siber Güvenlik Platformu
    </p>
  </div>
</body>
</html>`;
}

export const annualReportHelpers = {
  calculateMonthlyScores,
  detectTopAchievement,
  calculateSectorPercentile,
  getActiveCustomersWithScans,
  getYearScans,
  countClosedFindings,
  avgCriticalCloseDays,
  saveReport,
  generateAnnualReports,
};
