---
name: Funnel CTA pattern for tool pages
description: Standard assessment CTA block added to all tool pages; pattern and which pages are covered
---

All tool pages now have a contextual assessment CTA. Standard block pattern:

```jsx
<div className="mt-6 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
    <div>
      <p className="text-sm font-semibold text-foreground">[Context-specific headline]</p>
      <p className="text-xs text-muted-foreground mt-0.5">[Context-specific description]</p>
    </div>
    <a href="/assessment/start" className="shrink-0 inline-flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium px-4 py-2.5 rounded-lg whitespace-nowrap">
      Ücretsiz Değerlendirme →
    </a>
  </div>
</div>
```

Pages with CTA: domain-scan, kvkk-ceza-sim, roi-hesaplayici, sizinti-izleyici (previous session), plus m365-denetim, erp-tarama, kep-rehberi, kvkk-verbis, kvkk-dpa, siber-sigorta, phishing-sim, sektorel-kiyaslama, marka-koruma, dora-bddk-uyum (this session). Pages like finansal-kayip, saldiri-simulasyonu, tedarik-zinciri, siber-panik, guven-rozeti already had assessment CTAs.

**Why:** Every tool page is a funnel entry point — users come from search, consume the tool, then leave without converting. The CTA captures intent at peak engagement.
