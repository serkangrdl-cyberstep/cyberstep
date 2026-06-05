export const SERVICENOW_GUIDE = {
  title: "ServiceNow Entegrasyon Kurulumu",
  serviceSlug: "servicenow",
  estimatedMinutes: 120,
  difficulty: "İleri — CyberStep ekibiyle birlikte yapılır",

  model: "Teklif Al + Kurulum Desteği",
  note:
    "Bu entegrasyon kurulum sırasında CyberStep teknik ekibiyle birlikte yapılır. " +
    "Randevu: destek@cyberstep.io",

  prerequisites: [
    "ServiceNow admin erişimi",
    "ServiceNow versiyonu: Quebec ve üzeri",
    "CyberStep SOC Standart veya Pro aboneliği",
    "Statik IP veya webhook endpoint",
  ],

  steps: [
    {
      stepNo: 1,
      title: "Teknik Görüşme Randevusu",
      description:
        "destek@cyberstep.io adresine yazın. Kısa bir video görüşmesi (30 dk) planlanır.",
      handledBy: "Müşteri başlatır",
      estimatedSeconds: 0,
    },
    {
      stepNo: 2,
      title: "ServiceNow Inbound Integration",
      description:
        "ServiceNow → Integration Hub veya Scripted REST API → CyberStep için endpoint oluşturulur.",
      handledBy: "CyberStep teknik ekibi",
      estimatedSeconds: 0,
    },
    {
      stepNo: 3,
      title: "HMAC-SHA256 İmza Doğrulama",
      description: "Webhook güvenliği için imza kontrolü ServiceNow tarafında yapılandırılır.",
      handledBy: "CyberStep teknik ekibi",
      estimatedSeconds: 0,
    },
    {
      stepNo: 4,
      title: "Incident Şeması Haritalama",
      description:
        "CyberStep alarm alanlarının ServiceNow incident alanlarına nasıl eşleneceğini birlikte belirleriz.",
      handledBy: "Müşteri + CyberStep birlikte",
      estimatedSeconds: 0,
    },
    {
      stepNo: 5,
      title: "Test ve Doğrulama",
      description:
        "Test alarmı oluşturulur, ServiceNow'da göründüğü doğrulanır.",
      handledBy: "Birlikte",
      estimatedSeconds: 0,
    },
  ],

  salesProcess: [
    "1. Teklif formu doldur",
    "2. Teknik görüşme randevusu (30 dk, video)",
    "3. Kurulum günü belirle",
    "4. 3.000 TL kurulum ücreti + aylık 2.490 TL",
  ],

  troubleshooting: [
    {
      problem: "ServiceNow versiyonu uyumsuz",
      solution: "Quebec ve üzeri versiyonlarda tam destek vardır. Eski versiyonlar için destek@cyberstep.io ile görüşün.",
    },
    {
      problem: "Webhook ulaşmıyor",
      solution: "ServiceNow instance'ının CyberStep IP aralığından gelen isteklere izin verdiğini kontrol edin.",
    },
  ],
};
