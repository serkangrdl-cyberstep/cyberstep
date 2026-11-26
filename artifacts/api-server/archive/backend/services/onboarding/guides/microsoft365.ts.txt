export const MICROSOFT_365_GUIDE = {
  title: "Microsoft 365 Bağlantı Kurulumu",
  serviceSlug: "microsoft-365",
  estimatedMinutes: 15,
  difficulty: "Kolay — teknik bilgi gerekmez",

  prerequisites: [
    "Microsoft 365 Global Admin veya Security Admin rolü",
    "CyberStep portal hesabı (zaten var)",
  ],

  steps: [
    {
      stepNo: 1,
      title: "Azure Portal'a Giriş",
      description:
        "portal.azure.com adresine gidin. Microsoft 365 admin hesabınızla giriş yapın.",
      estimatedSeconds: 60,
    },
    {
      stepNo: 2,
      title: "App Registration Oluştur",
      description:
        "Azure Active Directory → App registrations → New registration seçin. " +
        "İsim: 'CyberStep Security Monitor' yazın. " +
        "Supported account types: 'Accounts in this organizational directory only' seçin. " +
        "Register butonuna tıklayın.",
      estimatedSeconds: 120,
    },
    {
      stepNo: 3,
      title: "Client Secret Oluştur",
      description:
        "Certificates & secrets → New client secret. " +
        "Description: 'CyberStep', Expires: 24 months. " +
        "Add butonuna tıklayın. Value sütunundaki değeri kopyalayın.",
      estimatedSeconds: 90,
      warning:
        "Secret değerini şimdi kopyalayın. Sayfayı kapattıktan sonra tekrar göremezsiniz.",
    },
    {
      stepNo: 4,
      title: "İzinleri Ayarla",
      description:
        "API permissions → Add permission → Microsoft Graph → Application permissions. " +
        "Şu izinleri ekleyin: AuditLog.Read.All, SecurityEvents.Read.All, IdentityRiskEvent.Read.All. " +
        "Grant admin consent butonuna tıklayın.",
      estimatedSeconds: 180,
    },
    {
      stepNo: 5,
      title: "CyberStep'e Bağla",
      description:
        "CyberStep Portal → Entegrasyonlarım → Microsoft 365 → Bağla. " +
        "Tenant ID, Client ID ve Client Secret değerlerini girin. " +
        "Bağlantıyı Test Et butonuna tıklayın.",
      estimatedSeconds: 60,
    },
    {
      stepNo: 6,
      title: "Test",
      description:
        "Bağlantı başarılı olunca ilk güvenlik eventleri 5 dakika içinde portal'da görünmeye başlar.",
      estimatedSeconds: 300,
    },
  ],

  troubleshooting: [
    {
      problem: "Bağlantı test başarısız",
      solution:
        "Client Secret'in doğru kopyalandığını kontrol edin. Boşluk veya özel karakter girmiş olabilirsiniz.",
    },
    {
      problem: "İzin hatası (403)",
      solution:
        "API permissions sayfasında Grant admin consent butonuna tıkladınız mı? " +
        "Global Admin rolüyle giriş yapmış olmanız gerekiyor.",
    },
    {
      problem: "Event görünmüyor",
      solution:
        "İlk eventlerin gelmesi 15 dakika sürebilir. " +
        "Azure AD'de test amaçlı başarısız bir giriş yaparsanız hemen görünür.",
    },
  ],

  salesNote:
    "Kurulum 15 dakika sürüyor. Kurulum sırasında sorun yaşarsanız destek@cyberstep.io adresine yazın, aynı gün yardım ederiz.",
};
