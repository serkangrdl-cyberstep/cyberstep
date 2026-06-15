# CyberStep — Admin Panel İç Tarama Sayfası + Script Kullanım Kılavuzu
## Replit Agent Promptu

---

## BAĞLAM

İki şey yapılacak:

1. Admin paneline "İç Tarama" sayfası — tüm müşterilerin iç tarama durumu
2. Müşteri paneline script kullanım kılavuzu modal/sayfası

Backend hazır:
- GET /api/admin-panel/customers/:customerId/security-report → JSON dönüyor
- internal_scans tablosu dolu
- ai_security_reports tablosu dolu

---

## BÖLÜM 1 — ADMIN PANELİ: İÇ TARAMA SAYFASI

### 1a. Yeni Backend Endpoint

Mevcut admin-panel route dosyasını bul, şu endpoint'i ekle:

```typescript
// GET /api/admin-panel/internal-scans/overview
// Tüm müşterilerin iç tarama özeti

router.get('/internal-scans/overview', adminAuth, async (req, res) => {

  // Tüm müşterileri iç tarama verileriyle çek
  const customers = await db.execute(sql`
    SELECT
      u.id                          AS customer_id,
      u.email,
      u.company_name,
      u.sector,

      -- Son iç tarama
      i.id                          AS scan_id,
      i.hostname,
      i.internal_score,
      i.scan_type,
      i.scanned_at,
      i.findings_count,

      -- Dış tarama skoru (karşılaştırma için)
      ps.overall_score              AS external_score,
      ps.letter_grade,

      -- AI raporu var mı
      ai.id                         AS ai_report_id,
      ai.generated_at               AS ai_report_date,

      -- Anket tamamlanma
      srv.id                        AS survey_id,
      srv.backup_enabled,
      srv.ir_plan_exists,
      srv.kvkk_verbis_registered

    FROM users u
    LEFT JOIN LATERAL (
      SELECT * FROM internal_scans
      WHERE customer_id = u.id
      ORDER BY scanned_at DESC LIMIT 1
    ) i ON true
    LEFT JOIN LATERAL (
      SELECT ps2.overall_score, ps2.letter_grade
      FROM enterprise_prospects ep
      JOIN prospect_scans ps2 ON ps2.prospect_id = ep.id
      WHERE ep.customer_id = u.id
      ORDER BY ps2.scanned_at DESC LIMIT 1
    ) ps ON true
    LEFT JOIN LATERAL (
      SELECT id, generated_at FROM ai_security_reports
      WHERE customer_id = u.id
      ORDER BY generated_at DESC LIMIT 1
    ) ai ON true
    LEFT JOIN internal_scan_surveys srv ON srv.customer_id = u.id
    WHERE u.role = 'customer'
    ORDER BY i.scanned_at DESC NULLS LAST
  `);

  // Özet istatistikler
  const rows = customers.rows as any[];
  const stats = {
    total_customers: rows.length,
    scanned: rows.filter(r => r.scan_id).length,
    not_scanned: rows.filter(r => !r.scan_id).length,
    avg_internal_score: Math.round(
      rows.filter(r => r.internal_score)
          .reduce((sum: number, r: any) => sum + r.internal_score, 0) /
      Math.max(rows.filter(r => r.internal_score).length, 1)
    ),
    ai_report_generated: rows.filter(r => r.ai_report_id).length,
    survey_completed: rows.filter(r => r.survey_id).length,
  };

  res.json({ customers: rows, stats });
});

// GET /api/admin-panel/internal-scans/customer/:customerId
// Tek müşterinin tarama geçmişi

router.get('/internal-scans/customer/:customerId', adminAuth, async (req, res) => {
  const customerId = parseInt(req.params.customerId);

  const scans = await db.query.internalScans.findMany({
    where: eq(internalScans.customerId, customerId),
    orderBy: desc(internalScans.scannedAt),
  });

  const aiReport = await db.query.aiSecurityReports.findFirst({
    where: eq(aiSecurityReports.customerId, customerId),
    orderBy: desc(aiSecurityReports.generatedAt),
  });

  const survey = await db.query.internalScanSurveys.findFirst({
    where: eq(internalScanSurveys.customerId, customerId),
  });

  res.json({ scans, aiReport, survey });
});
```

### 1b. Admin Paneli Frontend

Mevcut admin panel route yapısına uygun yeni sayfa ekle.
Dosya: admin panelindeki pages veya routes klasörüne `internal-scans.tsx` veya benzeri.
Route: `/panel/admin/ic-tarama`

Admin sidebar/nav'a link ekle:
```tsx
{ label: '🖥️ İç Tarama', href: '/panel/admin/ic-tarama' }
```

**Sayfa yapısı:**

```tsx
export default function AdminInternalScans() {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'scanned' | 'not_scanned'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin-panel/internal-scans/overview', {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
      .then(r => r.json())
      .then(setData);
  }, []);

  async function loadDetail(customerId: number) {
    setSelected(customerId);
    const res = await fetch(
      `/api/admin-panel/internal-scans/customer/${customerId}`,
      { headers: { Authorization: `Bearer ${getToken()}` } }
    );
    setDetail(await res.json());
  }

  if (!data) return <div>Yükleniyor...</div>;

  // Filtre uygula
  const filtered = data.customers
    .filter((c: any) =>
      filter === 'all' ? true :
      filter === 'scanned' ? !!c.scan_id :
      !c.scan_id
    )
    .filter((c: any) =>
      !search || c.email?.includes(search) ||
      c.company_name?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div style={{ padding: '24px 32px', background: '#060D1A',
      minHeight: '100vh', color: '#E8EDF5' }}>

      {/* Başlık */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900 }}>
          🖥️ İç Tarama Yönetimi
        </h1>
        <p style={{ fontSize: 13, color: '#8896A8', marginTop: 4 }}>
          Tüm müşterilerin iç tarama durumu ve AI rapor özeti
        </p>
      </div>

      {/* KPI kartları */}
      <div style={{ display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Toplam Müşteri',   value: data.stats.total_customers,     color: '#00C8FF' },
          { label: 'Tarama Yapıldı',   value: data.stats.scanned,             color: '#2ECC71' },
          { label: 'Tarama Yok',       value: data.stats.not_scanned,         color: '#E03A3A' },
          { label: 'Ort. İç Skor',     value: data.stats.avg_internal_score,  color: '#F5A623' },
          { label: 'AI Rapor Üretildi',value: data.stats.ai_report_generated, color: '#9B59B6' },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: '#0A1828', border: '1px solid #1A3050',
            borderRadius: 12, padding: '16px 20px',
          }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: kpi.color }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 12, color: '#8896A8', marginTop: 4 }}>
              {kpi.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filtre + Arama */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <input
          placeholder="Müşteri ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            background: '#0A1828', border: '1px solid #1A3050',
            borderRadius: 8, padding: '8px 14px',
            color: '#E8EDF5', fontSize: 13, width: 240,
          }}
        />
        {(['all', 'scanned', 'not_scanned'] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 12,
              fontWeight: 600, cursor: 'pointer', border: 'none',
              background: filter === f ? '#00C8FF' : '#0A1828',
              color: filter === f ? '#060D1A' : '#8896A8',
            }}
          >
            { f === 'all' ? 'Tümü' :
              f === 'scanned' ? '✓ Tarandı' : '✗ Taranmadı' }
          </button>
        ))}
      </div>

      {/* İki sütun: liste + detay */}
      <div style={{ display: 'grid',
        gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>

        {/* Müşteri listesi */}
        <div style={{ background: '#0A1828', border: '1px solid #1A3050',
          borderRadius: 14, overflow: 'hidden' }}>

          {/* Tablo başlığı */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 80px 80px 80px 60px',
            padding: '10px 16px', fontSize: 11,
            color: '#8896A8', letterSpacing: 1,
            borderBottom: '1px solid #1A3050',
            background: '#060D1A',
          }}>
            <span>MÜŞTERİ</span>
            <span style={{ textAlign: 'center' }}>DIŞ</span>
            <span style={{ textAlign: 'center' }}>İÇ</span>
            <span style={{ textAlign: 'center' }}>AI</span>
            <span style={{ textAlign: 'center' }}>ANKET</span>
            <span style={{ textAlign: 'center' }}>DETAY</span>
          </div>

          {/* Satırlar */}
          {filtered.map((c: any) => {
            const internalColor =
              !c.internal_score ? '#4A6080' :
              c.internal_score >= 70 ? '#2ECC71' :
              c.internal_score >= 50 ? '#F5A623' : '#E03A3A';

            return (
              <div key={c.customer_id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px 80px 80px 60px',
                padding: '12px 16px', fontSize: 12,
                borderBottom: '1px solid #1A3050',
                background: selected === c.customer_id
                  ? 'rgba(0,200,255,0.06)' : 'transparent',
                cursor: 'pointer',
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#E8EDF5' }}>
                    {c.company_name || c.email}
                  </div>
                  <div style={{ color: '#4A6080', fontSize: 11, marginTop: 2 }}>
                    {c.hostname || '—'} · {c.sector || '—'}
                  </div>
                </div>
                {/* Dış skor */}
                <div style={{ textAlign: 'center', fontWeight: 700,
                  color: c.external_score >= 70 ? '#2ECC71' :
                         c.external_score >= 50 ? '#F5A623' : '#E03A3A' }}>
                  {c.external_score ?? '—'}
                </div>
                {/* İç skor */}
                <div style={{ textAlign: 'center',
                  fontWeight: 700, color: internalColor }}>
                  {c.internal_score ?? '—'}
                </div>
                {/* AI rapor */}
                <div style={{ textAlign: 'center', fontSize: 14 }}>
                  {c.ai_report_id ? '✓' : '—'}
                </div>
                {/* Anket */}
                <div style={{ textAlign: 'center', fontSize: 14 }}>
                  {c.survey_id ? '✓' : '—'}
                </div>
                {/* Detay butonu */}
                <div style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => loadDetail(c.customer_id)}
                    style={{
                      background: '#00C8FF', color: '#060D1A',
                      border: 'none', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11,
                      fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Gör
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sağ: Müşteri detayı */}
        {selected && detail && (
          <CustomerScanDetail
            detail={detail}
            onClose={() => { setSelected(null); setDetail(null); }}
          />
        )}
      </div>
    </div>
  );
}

// Müşteri detay bileşeni
function CustomerScanDetail({
  detail, onClose
}: { detail: any; onClose: () => void }) {

  const latestScan = detail.scans?.[0];
  const aiReport = detail.aiReport;
  const survey = detail.survey;

  return (
    <div style={{ background: '#0A1828', border: '1px solid #00C8FF',
      borderRadius: 14, padding: 20, overflow: 'auto', maxHeight: 600 }}>

      <div style={{ display: 'flex', justifyContent: 'space-between',
        marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#E8EDF5' }}>
          Müşteri Detayı
        </div>
        <button onClick={onClose} style={{
          background: 'transparent', border: 'none',
          color: '#8896A8', cursor: 'pointer', fontSize: 18,
        }}>×</button>
      </div>

      {/* Tarama geçmişi */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#8896A8', letterSpacing: 1,
          marginBottom: 8 }}>TARAMA GEÇMİŞİ</div>
        {detail.scans?.length === 0 && (
          <div style={{ fontSize: 13, color: '#4A6080' }}>
            Henüz iç tarama yapılmamış
          </div>
        )}
        {detail.scans?.map((scan: any) => (
          <div key={scan.id} style={{
            background: '#060D1A', borderRadius: 8, padding: '10px 14px',
            marginBottom: 8, display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#E8EDF5' }}>
                {scan.hostname}
              </div>
              <div style={{ fontSize: 11, color: '#4A6080', marginTop: 2 }}>
                {scan.scan_type} ·{' '}
                {new Date(scan.scanned_at).toLocaleString('tr-TR')}
              </div>
            </div>
            <div style={{
              fontSize: 20, fontWeight: 900,
              color: scan.internal_score >= 70 ? '#2ECC71' :
                     scan.internal_score >= 50 ? '#F5A623' : '#E03A3A',
            }}>
              {scan.internal_score}
            </div>
          </div>
        ))}
      </div>

      {/* AI Rapor özeti */}
      {aiReport && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#8896A8', letterSpacing: 1,
            marginBottom: 8 }}>AI GÜVENLİK RAPORU</div>
          <div style={{ background: '#060D1A', borderRadius: 8,
            padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#4A6080', marginBottom: 8 }}>
              {new Date(aiReport.generated_at).toLocaleString('tr-TR')}
            </div>
            <div style={{ fontSize: 12, color: '#E8EDF5',
              lineHeight: 1.6, marginBottom: 12 }}>
              {aiReport.executive_summary?.slice(0, 300)}...
            </div>
            {/* Kritik aksiyonlar */}
            {aiReport.critical_actions?.slice(0, 3).map((a: any, i: number) => (
              <div key={i} style={{
                display: 'flex', gap: 8, marginBottom: 6,
                fontSize: 12, color: '#E03A3A',
              }}>
                <span>🔴</span> {a.title}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Anket özeti */}
      {survey && (
        <div>
          <div style={{ fontSize: 11, color: '#8896A8', letterSpacing: 1,
            marginBottom: 8 }}>ANKET DURUMU</div>
          <div style={{ display: 'grid',
            gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { label: 'Yedekleme', val: survey.backup_enabled },
              { label: 'IR Planı', val: survey.ir_plan_exists },
              { label: 'VERBİS', val: survey.kvkk_verbis_registered },
              { label: 'Siber Sigorta', val: survey.cyber_insurance },
            ].map(item => (
              <div key={item.label} style={{
                background: '#060D1A', borderRadius: 6,
                padding: '8px 12px',
                display: 'flex', justifyContent: 'space-between',
                fontSize: 12,
              }}>
                <span style={{ color: '#8896A8' }}>{item.label}</span>
                <span style={{
                  color: item.val === true ? '#2ECC71' :
                         item.val === false ? '#E03A3A' : '#4A6080',
                }}>
                  {item.val === true ? '✓ Var' :
                   item.val === false ? '✗ Yok' : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## BÖLÜM 2 — SCRIPT KULLANIM KILAVUZU

Müşteri panelinde `/hesabim/ic-tarama` sayfasındaki
script indirme bölümüne "Nasıl Çalıştırılır?" butonu ekle.
Butona basınca modal açılır.

```tsx
function ScriptGuideModal({
  os, onClose
}: { os: 'windows' | 'linux'; onClose: () => void }) {

  const steps = os === 'windows' ? [
    {
      title: '1. PowerShell\'i Yönetici Olarak Aç',
      content: 'Başlat menüsünde "PowerShell" arayın.\nSağ tıklayın → "Yönetici olarak çalıştır" seçin.',
      code: null,
      tip: 'Yönetici yetkisi olmadan da çalışır — ama bazı bilgiler eksik kalabilir.',
    },
    {
      title: '2. Script\'i Çalıştırın',
      content: 'Script indirdiğiniz klasöre gidin ve çalıştırın:',
      code: 'cd Downloads\n.\\cyberstep-scan.ps1',
      tip: '"Bu dosyayı çalıştırmak istiyor musunuz?" sorusuna Y yazıp Enter\'a basın.',
    },
    {
      title: '3. Bitti!',
      content: 'Script yaklaşık 1-2 dakika çalışır.\nBitince sonuçlar otomatik olarak platforma yüklenir.\nBu sayfayı yenileyerek sonuçlarınızı görebilirsiniz.',
      code: null,
      tip: null,
    },
  ] : [
    {
      title: '1. Terminal\'i Açın',
      content: 'Terminal uygulamasını açın.\nScript\'i indirdiğiniz klasöre gidin:',
      code: 'cd ~/Downloads',
      tip: null,
    },
    {
      title: '2. Çalıştırma İzni Verin',
      content: 'Script\'e çalıştırma izni verin:',
      code: 'chmod +x cyberstep-scan.sh',
      tip: null,
    },
    {
      title: '3. Script\'i Çalıştırın',
      content: 'Sudo ile çalıştırın (tam veri için gerekli):',
      code: 'sudo ./cyberstep-scan.sh',
      tip: 'Sudo olmadan da çalışır — bazı sistem bilgileri eksik kalabilir.',
    },
    {
      title: '4. Bitti!',
      content: 'Script yaklaşık 1-2 dakika çalışır.\nSonuçlar otomatik platforma yüklenir.',
      code: null,
      tip: null,
    },
  ];

  return (
    // Modal overlay
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100,
    }}
      onClick={onClose}
    >
      <div style={{
        background: '#0A1828',
        border: '1.5px solid #00C8FF',
        borderRadius: 16, padding: 32,
        width: 560, maxHeight: '85vh',
        overflow: 'auto',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 24,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#E8EDF5' }}>
              {os === 'windows' ? '🪟 Windows' : '🐧 Linux'} Script Nasıl Çalıştırılır?
            </div>
            <div style={{ fontSize: 12, color: '#8896A8', marginTop: 4 }}>
              Yaklaşık 5 dakika · Yönetici yetkisi önerilir
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none',
            color: '#8896A8', fontSize: 22, cursor: 'pointer',
          }}>×</button>
        </div>

        {/* Güvenlik notu */}
        <div style={{
          background: 'rgba(46,204,113,0.08)',
          border: '1px solid rgba(46,204,113,0.3)',
          borderRadius: 8, padding: '10px 14px',
          marginBottom: 24, fontSize: 12,
          color: '#2ECC71', lineHeight: 1.6,
        }}>
          🔒 Script yalnızca okuma yapar — hiçbir dosyayı değiştirmez veya silmez.
          Veriler şifreli bağlantıyla iletilir.
        </div>

        {/* Adımlar */}
        {steps.map((step, i) => (
          <div key={i} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 13, fontWeight: 700,
              color: '#00C8FF', marginBottom: 6,
            }}>
              {step.title}
            </div>
            <div style={{
              fontSize: 13, color: '#8896A8',
              lineHeight: 1.6, marginBottom: step.code ? 8 : 0,
              whiteSpace: 'pre-line',
            }}>
              {step.content}
            </div>
            {step.code && (
              <div style={{
                background: '#060D1A',
                border: '1px solid #1A3050',
                borderRadius: 6, padding: '10px 14px',
                fontFamily: 'Courier New, monospace',
                fontSize: 13, color: '#2ECC71',
                whiteSpace: 'pre',
              }}>
                {step.code}
              </div>
            )}
            {step.tip && (
              <div style={{
                fontSize: 11, color: '#F5A623',
                marginTop: 6, display: 'flex', gap: 6,
              }}>
                <span>💡</span> {step.tip}
              </div>
            )}
          </div>
        ))}

        {/* Test modu */}
        <div style={{
          background: '#060D1A',
          border: '1px solid #1A3050',
          borderRadius: 8, padding: 16, marginTop: 8,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700,
            color: '#8896A8', marginBottom: 8 }}>
            🧪 Önce Test Etmek İstiyorsanız (Offline Mod)
          </div>
          <div style={{
            fontFamily: 'Courier New, monospace',
            fontSize: 12, color: '#8896A8',
            whiteSpace: 'pre',
          }}>
            {os === 'windows'
              ? '.\\cyberstep-scan.ps1 -OutputFile "test.json"'
              : './cyberstep-scan.sh --output test.json'
            }
          </div>
          <div style={{ fontSize: 11, color: '#4A6080', marginTop: 6 }}>
            Sonuç platforma gönderilmez, dosyaya yazılır.
            İçeriği inceleyebilirsiniz.
          </div>
        </div>

        {/* Sorun mu var? */}
        <div style={{
          marginTop: 20, textAlign: 'center',
          fontSize: 12, color: '#4A6080',
        }}>
          Sorun mu yaşıyorsunuz?{' '}
          <a href="mailto:destek@cyberstep.io"
            style={{ color: '#00C8FF', textDecoration: 'none' }}>
            destek@cyberstep.io
          </a>
          {' '}veya{' '}
          <a href="/panel/destek"
            style={{ color: '#00C8FF', textDecoration: 'none' }}>
            destek talebi açın
          </a>
        </div>
      </div>
    </div>
  );
}
```

Script indirme kartlarında "Nasıl Çalıştırılır?" butonunu ekle:

```tsx
// Mevcut Windows ve Linux indirme kartlarına ekle:
const [showGuide, setShowGuide] = useState<'windows' | 'linux' | null>(null);

// Kart içine:
<button
  onClick={() => setShowGuide('windows')} // veya 'linux'
  style={{
    background: 'transparent',
    border: '1px solid #1A3050',
    color: '#8896A8', borderRadius: 8,
    padding: '8px 16px', fontSize: 12,
    cursor: 'pointer', marginTop: 8,
    width: '100%',
  }}
>
  📖 Nasıl Çalıştırılır?
</button>

// Sayfanın sonuna modal ekle:
{showGuide && (
  <ScriptGuideModal
    os={showGuide}
    onClose={() => setShowGuide(null)}
  />
)}
```

---

## TEST

**Admin Paneli:**
- [ ] `/panel/admin/ic-tarama` sayfası açılıyor
- [ ] 5 KPI kartı doğru sayıları gösteriyor
- [ ] Müşteri listesinde dış + iç skor yan yana görünüyor
- [ ] "Gör" butonuna basınca sağda detay paneli açılıyor
- [ ] Tarama geçmişi doğru sırada (yeniden eskiye)
- [ ] AI raporu özeti görünüyor (varsa)
- [ ] Anket durumu görünüyor

**Script Kılavuzu:**
- [ ] Windows kartında "Nasıl Çalıştırılır?" butonu var
- [ ] Linux kartında "Nasıl Çalıştırılır?" butonu var
- [ ] Modal açılıyor, doğru OS için içerik gösteriyor
- [ ] Güvenlik notu yeşil kutuda görünüyor
- [ ] Test modu (offline) açıklaması var
- [ ] Modal dışına tıklayınca kapanıyor

---

## KISITLAR

- Mevcut script indirme kartlarına dokunma — sadece buton + modal ekle
- Admin sayfasını mevcut admin panel layout'una göre style et
- SQL sorgusundaki tablo ve kolon adlarını mevcut şemaya göre ayarla
- Modal HTML form etiketi kullanmıyor — onClick ile yönetiliyor
- getToken() mevcut auth helper'ını kullan
