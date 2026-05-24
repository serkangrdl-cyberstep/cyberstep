// Mini Assessment scoring configuration
export const MINI_QUESTIONS: Array<{
  number: number;
  weight: 1 | 2;
  isRedAlarm: boolean;
  domain: string;
}> = [
  // A. Firma ve Yönetişim
  { number: 1, weight: 1, isRedAlarm: false, domain: "Firma ve Yönetişim" },
  { number: 2, weight: 1, isRedAlarm: false, domain: "Firma ve Yönetişim" },
  { number: 3, weight: 2, isRedAlarm: true, domain: "Firma ve Yönetişim" },
  { number: 4, weight: 1, isRedAlarm: false, domain: "Firma ve Yönetişim" },
  // B. Kimlik, Erişim ve Uzak Erişim
  { number: 5, weight: 2, isRedAlarm: true, domain: "Kimlik ve Erişim" },
  { number: 6, weight: 2, isRedAlarm: true, domain: "Kimlik ve Erişim" },
  { number: 7, weight: 2, isRedAlarm: true, domain: "Kimlik ve Erişim" },
  { number: 8, weight: 1, isRedAlarm: false, domain: "Kimlik ve Erişim" },
  // C. E-posta ve Kullanıcı Kaynaklı Riskler
  { number: 9, weight: 1, isRedAlarm: false, domain: "E-posta ve İnsan Faktörü" },
  { number: 10, weight: 1, isRedAlarm: false, domain: "E-posta ve İnsan Faktörü" },
  { number: 11, weight: 2, isRedAlarm: true, domain: "E-posta ve İnsan Faktörü" },
  { number: 12, weight: 2, isRedAlarm: true, domain: "E-posta ve İnsan Faktörü" },
  // D. Cihaz ve Uç Nokta Güvenliği
  { number: 13, weight: 1, isRedAlarm: false, domain: "Cihaz Güvenliği" },
  { number: 14, weight: 2, isRedAlarm: true, domain: "Cihaz Güvenliği" },
  { number: 15, weight: 1, isRedAlarm: false, domain: "Cihaz Güvenliği" },
  { number: 16, weight: 1, isRedAlarm: false, domain: "Cihaz Güvenliği" },
  // E. Veri Koruma, Yedekleme ve Olay Hazırlığı
  { number: 17, weight: 2, isRedAlarm: true, domain: "Veri Koruma ve Yedekleme" },
  { number: 18, weight: 2, isRedAlarm: true, domain: "Veri Koruma ve Yedekleme" },
  { number: 19, weight: 1, isRedAlarm: false, domain: "Veri Koruma ve Yedekleme" },
  { number: 20, weight: 1, isRedAlarm: false, domain: "Veri Koruma ve Yedekleme" },
];

export const ANSWER_SCORES: Record<string, number> = {
  evet: 5,
  kismen: 3,
  bilmiyorum: 1,
  hayir: 0,
};

export function calculateScore(answers: Array<{ questionNumber: number; answer: string }>) {
  let totalScore = 0;
  let maxScore = 0;
  const redAlarmQuestions: number[] = [];

  const domainMap: Record<string, { score: number; maxScore: number }> = {};

  for (const q of MINI_QUESTIONS) {
    const ans = answers.find((a) => a.questionNumber === q.number);
    const rawScore = ans ? (ANSWER_SCORES[ans.answer] ?? 0) : 0;
    const weighted = rawScore * q.weight;
    const maxWeighted = 5 * q.weight;

    totalScore += weighted;
    maxScore += maxWeighted;

    if (!domainMap[q.domain]) {
      domainMap[q.domain] = { score: 0, maxScore: 0 };
    }
    domainMap[q.domain].score += weighted;
    domainMap[q.domain].maxScore += maxWeighted;

    if (q.isRedAlarm && rawScore === 0) {
      redAlarmQuestions.push(q.number);
    }
  }

  const domainScores = Object.entries(domainMap).map(([domain, vals]) => ({
    domain,
    score: vals.score,
    maxScore: vals.maxScore,
    percent: Math.round((vals.score / vals.maxScore) * 100),
  }));

  const scorePercent = Math.round((totalScore / maxScore) * 100);
  let riskLevel: string;
  if (scorePercent >= 80) riskLevel = "Düşük";
  else if (scorePercent >= 60) riskLevel = "Orta";
  else if (scorePercent >= 40) riskLevel = "Yüksek";
  else riskLevel = "Kritik";

  return {
    totalScore,
    maxScore,
    scorePercent,
    riskLevel,
    redAlarmCount: redAlarmQuestions.length,
    redAlarmQuestions,
    domainScores,
  };
}
