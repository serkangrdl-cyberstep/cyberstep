import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Shield, Download, Loader2, FileText, CheckCircle2 } from "lucide-react";

const DATA_CATEGORY_OPTIONS = [
  "Ad, Soyad", "E-posta Adresi", "Telefon Numarası", "TC Kimlik No",
  "Adres Bilgileri", "Finansal Veriler", "Sağlık Verileri", "Biyometrik Veriler",
  "Konum Verileri", "İnsan Kaynakları Verileri", "Müşteri İşlem Geçmişi",
];

export default function KvkkDpa() {
  const [form, setForm] = useState({
    companyName: "",
    partnerName: "",
    partnerRole: "Veri İşleyen",
    processingPurpose: "",
    sector: "",
    retentionPeriod: "Hizmet sözleşmesi süresi boyunca",
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftText, setDraftText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  }

  async function handleGenerate() {
    if (!form.companyName || !form.partnerName || !processingPurpose() || selectedCategories.length === 0) {
      setError("Lütfen tüm zorunlu alanları doldurun ve en az bir veri kategorisi seçin.");
      return;
    }
    setError(null);
    setLoading(true);
    setDraftText(null);
    try {
      const res = await fetch("/api/kvkk/dpa-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: form.companyName,
          partnerName: form.partnerName,
          partnerRole: form.partnerRole,
          dataCategories: selectedCategories,
          processingPurpose: form.processingPurpose,
          sector: form.sector,
          retentionPeriod: form.retentionPeriod,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).error ?? "Sözleşme oluşturulamadı");
      }
      const data = await res.json();
      setDraftText(data.draftText);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Beklenmeyen bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  function processingPurpose() {
    return form.processingPurpose.trim();
  }

  function handleDownloadTxt() {
    if (!draftText) return;
    const blob = new Blob([draftText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `KVKK_DPA_${form.companyName}_${form.partnerName}.txt`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">KVKK DPA Sözlesme Taslagi</h1>
          <p className="text-sm text-muted-foreground">Veri Isleme Anlasması (DPA) olusturun — hızlı, AI destekli, Türkiye KVKK uyumlu</p>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sözlesme Bilgileri</CardTitle>
          <CardDescription>Zorunlu alanları doldurun, AI otomatik taslak olusturacak.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="companyName">Veri Sorumlusu (Firmanız) *</Label>
              <Input
                id="companyName"
                placeholder="Örn: ABC Bilisim Ltd. Sti."
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partnerName">Veri İsleyen (Tedarikçi/Ortak) *</Label>
              <Input
                id="partnerName"
                placeholder="Örn: XYZ Yazılım A.S."
                value={form.partnerName}
                onChange={e => setForm(f => ({ ...f, partnerName: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="sector">Sektör</Label>
              <Input
                id="sector"
                placeholder="Örn: E-ticaret, Sağlık, Finans"
                value={form.sector}
                onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="retentionPeriod">Saklama Süresi</Label>
              <Input
                id="retentionPeriod"
                value={form.retentionPeriod}
                onChange={e => setForm(f => ({ ...f, retentionPeriod: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="processingPurpose">Veri İsleme Amacı *</Label>
            <Textarea
              id="processingPurpose"
              placeholder="Örn: Müsteri siparisleri ve teslimat yönetimi, fatura düzenleme, müsteri hizmetleri"
              value={form.processingPurpose}
              onChange={e => setForm(f => ({ ...f, processingPurpose: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>İslenen Veri Kategorileri *</Label>
            <div className="flex flex-wrap gap-2">
              {DATA_CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
                    selectedCategories.includes(cat)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            {selectedCategories.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Seçilen: {selectedCategories.join(", ")}
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Taslak Olusturuluyor...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                DPA Taslagi Olustur
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {draftText && (
        <Card className="shadow-sm border-green-200 bg-green-50/30 dark:bg-green-950/10 dark:border-green-900">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Taslak Hazır
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadTxt}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  İndir (.txt)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(draftText).catch(() => {})}
                  className="gap-1.5"
                >
                  Kopyala
                </Button>
              </div>
            </div>
            <CardDescription>
              AI tarafından olusturulan taslak. Kesin hukuki geçerlilik için bir avukata danısın.
              <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-200">Taslak</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-white dark:bg-slate-900 rounded-lg border p-4 max-h-[500px] overflow-y-auto">
              {draftText}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Assessment CTA */}
      <div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Sözleşme hazır — teknik tedbirler nasıl?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              KVKK Md.12 uyumu sözleşmelerle bitmez. Teknik güvenlik durumunuzu 20 dakikada ücretsiz değerlendirin.
            </p>
          </div>
          <a href="/assessment/start" className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap">
            Ücretsiz Değerlendirme →
          </a>
        </div>
      </div>
    </div>
  );
}
