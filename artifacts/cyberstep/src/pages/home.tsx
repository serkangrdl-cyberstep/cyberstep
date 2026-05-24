import { Link } from "wouter";
import { Shield, ChevronRight, CheckCircle, BarChart, ShieldAlert } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col flex-1">
      <section className="py-20 md:py-32 bg-secondary text-secondary-foreground relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-secondary to-secondary pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary-foreground text-sm font-medium mb-4">
              <Shield className="h-4 w-4" />
              <span>KOBİ'ler için Siber Güvenlik Analizi</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
              Siber risklerinizi görünür kılın, önlem alın.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Şirketinizin siber güvenlik olgunluğunu 5 dakikada ölçün. Zayıf noktalarınızı keşfedin ve profesyonel bir yol haritası ile güvende kalın.
            </p>
            <div className="pt-4">
              <Link
                href="/assessment/start"
                className="inline-flex items-center justify-center rounded-md text-lg font-medium transition-colors bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8"
              >
                Ücretsiz Değerlendirme Başla
                <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground">Nasıl Çalışır?</h2>
            <p className="text-muted-foreground mt-4">Sadece 3 adımda siber güvenlik durumunuzu analiz edin.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">1. Formu Doldurun</h3>
              <p className="text-muted-foreground">İşletmenizle ilgili 20 kritik soruyu yanıtlayın. Teknik bilgi gerektirmez.</p>
            </div>
            
            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <BarChart className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">2. Yapay Zeka Analizi</h3>
              <p className="text-muted-foreground">Verileriniz anında analiz edilir ve risk skorunuz hesaplanır.</p>
            </div>
            
            <div className="bg-card border rounded-lg p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold">3. Raporunuzu Alın</h3>
              <p className="text-muted-foreground">Öncelikli zafiyetlerinizi ve çözüm önerilerini içeren detaylı raporunuza ulaşın.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
