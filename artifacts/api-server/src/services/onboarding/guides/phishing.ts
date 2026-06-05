export const PHISHING_GUIDE = {
  title: "AI Phishing Risk Analizi — Başlangıç Formu",
  serviceSlug: "phishing-simulation",
  estimatedMinutes: 5,
  difficulty: "Kolay",

  description:
    "Domain bilgilerinizi girin, AI saldırgan gözüyle 5 phishing senaryosu üretir. " +
    "Çalışan farkındalık eğitiminde kullanabilirsiniz. Gerçek email gönderimi yapılmaz.",

  analysisForm: {
    fields: [
      {
        id: "domain",
        label: "Şirket domain adı",
        type: "text",
        placeholder: "sirket.com.tr",
        helpText: "Bu domain üzerinden açık kaynak bilgi toplanır (OSINT)",
        required: true,
      },
      {
        id: "sector",
        label: "Sektör",
        type: "select",
        options: [
          "Finans / Bankacılık",
          "Sağlık",
          "Üretim",
          "Perakende / E-ticaret",
          "Teknoloji",
          "Eğitim",
          "Diğer",
        ],
        required: true,
      },
      {
        id: "employee_count",
        label: "Çalışan sayısı",
        type: "select",
        options: ["1-20", "21-100", "101-500", "500+"],
        required: true,
      },
      {
        id: "known_risks",
        label: "Endişelendiğiniz konular",
        type: "multiselect",
        options: [
          "CEO fraud / BEC",
          "Fatura sahteciliği",
          "Kimlik bilgisi hırsızlığı",
          "Tedarikçi taklidi",
          "Genel phishing",
        ],
        required: false,
      },
    ],
  },

  expectationNote:
    "Bu hizmet gerçek email göndermez. " +
    "AI ile 5 spear-phishing senaryosu ve çalışan farkındalık raporu üretilir. " +
    "Rapor 2-3 iş günü içinde emailinize gelir.",
};
