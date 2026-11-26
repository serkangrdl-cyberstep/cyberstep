const IOC_SOURCE_WEIGHTS: Record<string, number> = {
  cisa_kev:   100,
  usom:        85,
  feodo:       85,
  threatfox:   75,
  urlhaus:     70,
  virustotal:  70,
  spamhaus:    80,
  greynoise:   65,
  otx:         60,
  unknown:     30,
};

export function calculateIOCConfidence(
  sources: string[],
  additionalSignals?: {
    virusTotalPositives?: number;
    ageInDays?: number;
    sightingsCount?: number;
  },
): { score: number; level: string; explanation: string } {
  if (!sources || sources.length === 0) {
    return { score: 0, level: "none", explanation: "Kaynak yok" };
  }

  const maxWeight = Math.max(...sources.map(s => IOC_SOURCE_WEIGHTS[s] ?? 30));
  let score = maxWeight;
  const bonuses: string[] = [];

  if (sources.length >= 3) {
    score += 15;
    bonuses.push(`${sources.length} kaynak`);
  } else if (sources.length === 2) {
    score += 8;
    bonuses.push("2 kaynak");
  }

  if (additionalSignals?.virusTotalPositives) {
    const vt = additionalSignals.virusTotalPositives;
    if (vt >= 20) { score += 10; bonuses.push("VT 20+"); }
    else if (vt >= 10) { score += 6; bonuses.push("VT 10+"); }
    else if (vt >= 5) { score += 3; bonuses.push("VT 5+"); }
  }

  if (additionalSignals?.ageInDays) {
    const age = additionalSignals.ageInDays;
    if (age > 365) score -= 20;
    else if (age > 180) score -= 10;
    else if (age > 90) score -= 5;
  }

  score = Math.min(100, Math.max(0, score));

  const level =
    score >= 80 ? "high" :
    score >= 60 ? "medium" :
    score >= 40 ? "low" : "minimal";

  const explanation = [
    `Kaynaklar: ${sources.join(", ")}`,
    ...bonuses,
    `Skor: ${score}/100`,
  ].join(" | ");

  return { score, level, explanation };
}
