import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Cookie, X, ChevronDown, ChevronUp, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const STORAGE_KEY = "cyberstep_cookie_consent";

interface CookiePrefs {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
}

function loadPrefs(): CookiePrefs | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CookiePrefs) : null;
  } catch { return null; }
}

function savePrefs(prefs: CookiePrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function useCookieConsent() {
  const prefs = loadPrefs();
  return {
    analytics: prefs?.analytics ?? false,
    marketing: prefs?.marketing ?? false,
    hasConsented: prefs !== null,
  };
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const prefs = loadPrefs();
    if (!prefs) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const accept = (all: boolean) => {
    savePrefs({ necessary: true, analytics: all || analytics, marketing: all || marketing, timestamp: Date.now() });
    setSaved(true);
    setTimeout(() => setVisible(false), 700);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom-4 duration-300">
      <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 p-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Cookie className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Çerez Tercihleriniz</h3>
              <p className="text-slate-400 text-xs mt-0.5">
                Deneyiminizi kişiselleştirmek ve hizmetlerimizi geliştirmek için çerezler kullanıyoruz.{" "}
                <Link href="/cerez-politikasi" className="text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline">Çerez Politikası</Link>
              </p>
            </div>
          </div>
          <button onClick={() => accept(false)} className="text-slate-500 hover:text-slate-300 flex-shrink-0 mt-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Expandable categories */}
        <div className="px-5">
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-xs py-2 transition-colors">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Çerez kategorilerini yönet
          </button>

          {expanded && (
            <div className="space-y-3 pb-4 border-t border-slate-800 pt-3">
              {/* Necessary */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">Zorunlu Çerezler</div>
                    <div className="text-slate-500 text-xs">Oturum yönetimi ve güvenlik</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-xs">Her zaman aktif</span>
                  <Switch checked disabled className="opacity-50 scale-90" />
                </div>
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <span className="text-blue-400 text-xs font-bold">A</span>
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">Analitik Çerezler</div>
                    <div className="text-slate-500 text-xs">Platform kullanım istatistikleri (anonim)</div>
                  </div>
                </div>
                <Switch checked={analytics} onCheckedChange={setAnalytics} className="scale-90" />
              </div>

              {/* Marketing */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                    <span className="text-violet-400 text-xs font-bold">P</span>
                  </div>
                  <div>
                    <div className="text-white text-sm font-medium">Pazarlama Çerezleri</div>
                    <div className="text-slate-500 text-xs">Kişiselleştirilmiş içerik ve reklamlar</div>
                  </div>
                </div>
                <Switch checked={marketing} onCheckedChange={setMarketing} className="scale-90" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2 px-5 py-4 border-t border-slate-800 bg-slate-900/50">
          {saved ? (
            <div className="flex items-center gap-2 text-emerald-400 text-sm">
              <Check className="h-4 w-4" /> Tercihleriniz kaydedildi
            </div>
          ) : (
            <>
              <Button size="sm" onClick={() => accept(true)} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white text-sm h-9">
                Tümünü Kabul Et
              </Button>
              <Button size="sm" variant="outline" onClick={() => accept(false)}
                className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white text-sm h-9">
                {expanded ? "Seçimlerimi Kaydet" : "Yalnızca Zorunluları Kabul Et"}
              </Button>
              {!expanded && (
                <Button size="sm" variant="ghost" onClick={() => setExpanded(true)}
                  className="w-full sm:w-auto text-slate-400 hover:text-white text-sm h-9">
                  Özelleştir
                </Button>
              )}
            </>
          )}
          <div className="text-slate-600 text-xs sm:ml-auto text-center sm:text-right">
            <Link href="/gizlilik-politikasi" className="hover:text-slate-400 transition-colors">Gizlilik</Link>
            {" · "}
            <Link href="/kullanim-kosullari" className="hover:text-slate-400 transition-colors">Koşullar</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
