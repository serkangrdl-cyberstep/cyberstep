import { useState } from "react";
import { Copy, Check, Share2, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";

const GRADE_COLOR: Record<string, string> = {
  A: "#2ECC71",
  B: "#57CC6F",
  C: "#F39C12",
  D: "#E67E22",
  F: "#E03A3A",
};

const GRADE_LABEL: Record<string, string> = {
  A: "Güvenlik Profili İyi",
  B: "Kabul Edilebilir",
  C: "İyileştirme Gerekiyor",
  D: "Ciddi Riskler Var",
  F: "Kritik Açıklar",
};

function gradeColor(g: string) {
  return GRADE_COLOR[g] ?? GRADE_COLOR["F"]!;
}

interface Props {
  score: number;
  grade: string;
  domain: string;
  companyName?: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  sectorAvg?: number;
  scanDate?: string | Date | null;
  variant?: "full" | "compact" | "share";
  badgeToken?: string | null;
  isPubliclyShared?: boolean;
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color = gradeColor(grade);
  const radius = 44;
  const circ = 2 * Math.PI * radius;
  const filled = circ - (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 112, height: 112 }}>
      <svg width="112" height="112" style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx="56" cy="56" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={filled}
          transform="rotate(-90 56 56)"
        />
      </svg>
      <div className="flex flex-col items-center leading-none z-10">
        <span className="text-2xl font-black text-white">{score}</span>
        <span className="text-[10px] text-white/40 mt-0.5">/100</span>
      </div>
    </div>
  );
}

function GradeBar({ grade }: { grade: string }) {
  const grades = ["F", "D", "C", "B", "A"];
  const active = grades.indexOf(grade);
  return (
    <div className="flex gap-1 items-center">
      {grades.map((g, i) => (
        <div
          key={g}
          className="flex flex-col items-center gap-0.5"
        >
          <div
            style={{
              width: 28,
              height: i === active ? 20 : 12,
              borderRadius: 4,
              background: i === active ? gradeColor(g) : "rgba(255,255,255,0.08)",
              transition: "all 0.2s",
            }}
          />
          <span
            style={{
              fontSize: 10,
              fontWeight: i === active ? 700 : 400,
              color: i === active ? gradeColor(g) : "rgba(255,255,255,0.25)",
            }}
          >
            {g}
          </span>
        </div>
      ))}
    </div>
  );
}

function MetricBox({ label, count, color }: { label: string; count: number; color: string }) {
  const empty = count === 0;
  return (
    <div
      style={{
        flex: 1,
        borderRadius: 8,
        padding: "10px 8px",
        background: empty ? "rgba(255,255,255,0.04)" : `${color}12`,
        border: `1px solid ${empty ? "rgba(255,255,255,0.08)" : color + "30"}`,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 900, color: empty ? "rgba(255,255,255,0.22)" : color, lineHeight: 1 }}>{count}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 3, whiteSpace: "nowrap" }}>{label}</div>
    </div>
  );
}

function SectorBar({ score, sectorAvg }: { score: number; sectorAvg: number }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Sektör Ort. {sectorAvg}</span>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>Sizin Skorunuz {score}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", position: "relative", overflow: "visible" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            borderRadius: 3,
            width: `${score}%`,
            background: "linear-gradient(90deg, #00C8FF40, #00C8FF)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -3,
            left: `${sectorAvg}%`,
            width: 2,
            height: 12,
            borderRadius: 1,
            background: "#F39C12",
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </div>
  );
}

export function SecurityScoreCard({
  score,
  grade,
  domain,
  companyName,
  criticalCount,
  highCount,
  mediumCount,
  sectorAvg = 54,
  scanDate,
  variant = "full",
  badgeToken,
  isPubliclyShared,
}: Props) {
  const [copied, setCopied] = useState(false);
  const color = gradeColor(grade);
  const label = GRADE_LABEL[grade] ?? GRADE_LABEL["F"]!;

  const scanDateStr = scanDate
    ? new Date(
        typeof scanDate === "string" && !scanDate.endsWith("Z") ? scanDate + "Z" : scanDate
      ).toLocaleDateString("tr-TR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const shareUrl = badgeToken ? `https://cyberstep.io/sonuc/${badgeToken}` : null;

  function handleCopy() {
    if (!shareUrl) return;
    void navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (variant === "compact") {
    return (
      <div
        style={{
          background: "linear-gradient(135deg,#060D1A,#0D1F3C)",
          border: "1px solid rgba(0,200,255,0.15)",
          borderRadius: 12,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <ScoreRing score={score} grade={grade} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{domain}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
            <span style={{ color, fontWeight: 600 }}>{grade} Notu</span>
            <span className="mx-1">·</span>{label}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <MetricBox label="Kritik CVE" count={criticalCount} color="#E03A3A" />
            <MetricBox label="Yüksek CVE" count={highCount} color="#E67E22" />
            <MetricBox label="Orta CVE" count={mediumCount} color="#F39C12" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "share") {
    return (
      <div
        style={{
          background: "linear-gradient(135deg,#060D1A,#0D1F3C)",
          border: `1px solid ${color}40`,
          borderRadius: 16,
          padding: 20,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>
          CYBERSTEP.IO · Güvenlik Skoru
        </div>
        <ScoreRing score={score} grade={grade} />
        <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 8 }}>{grade}</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>{domain}</div>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
          <GradeBar grade={grade} />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "linear-gradient(135deg,#060D1A,#0D1F3C)",
        border: "1px solid rgba(0,200,255,0.12)",
        borderRadius: 16,
        padding: 24,
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
        <ScoreRing score={score} grade={grade} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            Paylaşılabilir Güvenlik Kartı
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "white", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {companyName || domain}
          </div>
          {companyName && companyName !== domain && (
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>{domain}</div>
          )}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              marginTop: 6,
              padding: "3px 10px",
              borderRadius: 6,
              background: `${color}18`,
              border: `1px solid ${color}40`,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 900, color }}>{grade}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{label}</span>
          </div>
        </div>
      </div>

      {/* Grade bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Güvenlik Notu Skalası</div>
        <GradeBar grade={grade} />
      </div>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <MetricBox label="Kritik CVE" count={criticalCount} color="#E03A3A" />
        <MetricBox label="Yüksek CVE" count={highCount} color="#E67E22" />
        <MetricBox label="Orta CVE" count={mediumCount} color="#F39C12" />
      </div>

      {/* Sector comparison */}
      <div
        style={{
          background: "rgba(255,255,255,0.03)",
          borderRadius: 8,
          padding: "10px 12px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>Sektör Karşılaştırması (Genel Ortalama)</div>
        <SectorBar score={score} sectorAvg={sectorAvg} />
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
          {scanDateStr ? `Tarama: ${scanDateStr}` : "cyberstep.io"}
        </span>
        {isPubliclyShared && shareUrl && (
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
              {copied ? "Kopyalandı" : "Linki Kopyala"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/40"
              asChild
            >
              <a
                href={`https://linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Linkedin className="h-3 w-3 mr-1" />
                LinkedIn
              </a>
            </Button>
          </div>
        )}
        {!isPubliclyShared && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Share2 className="h-3 w-3 text-white/20" />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>Paylaşım kapalı</span>
          </div>
        )}
      </div>
    </div>
  );
}
