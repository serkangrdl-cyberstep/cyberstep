import { useState, useCallback } from "react";

export interface WidgetDef {
  id: string;
  label: string;
  description: string;
  defaultVisible: boolean;
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  {
    id: "signal_pills",
    label: "Anlık Durum",
    description: "Sızıntı, CVE, Gölge IT ve açık port özeti",
    defaultVisible: true,
  },
  {
    id: "score_trend",
    label: "Güvenlik Trendi",
    description: "Güvenlik skorunuzun zaman içindeki değişimi",
    defaultVisible: true,
  },
  {
    id: "security_roadmap",
    label: "Güvenlik Yol Haritası",
    description: "30/90/180 günlük öncelikli aksiyon planı",
    defaultVisible: true,
  },
  {
    id: "ransomware",
    label: "Fidye Yazılımı Riski",
    description: "Maruziyet skoru ve katkı faktörleri",
    defaultVisible: true,
  },
  {
    id: "domain_hijack",
    label: "Domain Dayanıklılığı",
    description: "SPF, DKIM, DMARC ve SSL durumu",
    defaultVisible: true,
  },
  {
    id: "sector_benchmark",
    label: "Sektör Karşılaştırması",
    description: "Sektör ortalamasına göre konumunuz",
    defaultVisible: true,
  },
  {
    id: "kurulum_durumu",
    label: "Kurulum Durumu",
    description: "Tamamlanmamış kurulum adımları",
    defaultVisible: true,
  },
  {
    id: "health_score",
    label: "Hesap Sağlığı",
    description: "Platform kullanım ve müşteri sağlık skoru",
    defaultVisible: false,
  },
  {
    id: "active_services",
    label: "Aktif Servisler",
    description: "Aktif abonelikler ve servis durumu",
    defaultVisible: false,
  },
  {
    id: "vendor_risk",
    label: "Tedarikçi Riski",
    description: "Tedarikçi portföyü güvenlik durumu",
    defaultVisible: false,
  },
  {
    id: "plan_features",
    label: "Hizmet Planım",
    description: "Mevcut plan ve yükseltme seçenekleri",
    defaultVisible: false,
  },
];

const STORAGE_KEY = "cyberstep_dashboard_prefs_v1";

function loadSaved(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Record<string, boolean>;
  } catch { /* ignore */ }
  return {};
}

function buildVisibility(saved: Record<string, boolean>): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const w of WIDGET_REGISTRY) {
    result[w.id] = w.id in saved ? (saved[w.id] ?? w.defaultVisible) : w.defaultVisible;
  }
  return result;
}

export function useDashboardPrefs() {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    buildVisibility(loadSaved())
  );

  const toggle = useCallback((id: string) => {
    setVisibility(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setVisibility(buildVisibility({}));
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const isVisible = useCallback((id: string): boolean => visibility[id] ?? false, [visibility]);

  return { visibility, toggle, reset, isVisible };
}
