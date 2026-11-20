import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

interface Evidence { id: number; kind: string; file_name: string; size: number; created_at: string }
interface Consent { id: number; scopes: string[]; signer_name: string; signer_title: string | null; valid_from: string; valid_until: string; doc_name: string; revoked_at: string | null }

const KIND: Record<string, string> = { iso27001: "ISO 27001", pentest: "Sızma testi", soc2: "SOC 2", diger: "Diğer" };

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(new Error("Dosya okunamadı"));
    r.readAsDataURL(file);
  });
}

export function VendorConsentPanel({ vendorId }: { vendorId: number }) {
  const qc = useQueryClient();
  const ev = useQuery<{ evidence: Evidence[] }>({
    queryKey: ["tprm-evidence", vendorId],
    queryFn: () => fetch(`/api/tprm/vendors/${vendorId}/evidence`, { credentials: "include" }).then(r => r.json()),
  });
  const cs = useQuery<{ consents: Consent[]; scopeLabels: Record<string, string> }>({
    queryKey: ["tprm-consents", vendorId],
    queryFn: () => fetch(`/api/tprm/vendors/${vendorId}/consents`, { credentials: "include" }).then(r => r.json()),
  });
  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState<string[]>([]);
  const [signer, setSigner] = useState("");
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [until, setUntil] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const labels = cs.data?.scopeLabels ?? {};
  const now = Date.now();
  const active = (c: Consent) => !c.revoked_at && new Date(c.valid_from).getTime() <= now && now < new Date(c.valid_until).getTime();

  async function save() {
    setErr(null);
    if (!file) { setErr("Yazılı onay belgesini (PDF/PNG/JPG) ekleyin"); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/tprm/vendors/${vendorId}/consents`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopes, signerName: signer, signerTitle: title, validFrom: from, validUntil: until, fileName: file.name, dataBase64: await toBase64(file) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Kaydedilemedi");
      setOpen(false); setScopes([]); setSigner(""); setTitle(""); setUntil(""); setFile(null);
      qc.invalidateQueries({ queryKey: ["tprm-consents", vendorId] });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function revoke(id: number) {
    await fetch(`/api/tprm/vendors/${vendorId}/consents/${id}/revoke`, { method: "POST", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["tprm-consents", vendorId] });
  }

  const evidence = ev.data?.evidence ?? [];
  const consents = cs.data?.consents ?? [];
  return (
    <div className="space-y-3">
      {evidence.length > 0 && (
        <div className="rounded-lg bg-muted/30 p-3 space-y-1">
          <p className="text-xs font-semibold">Tedarikçinin yüklediği kanıt belgeleri (doğrulanmamış)</p>
          {evidence.map(e => (
            <a key={e.id} className="block text-xs text-primary hover:underline" href={`/api/tprm/vendors/${vendorId}/evidence/${e.id}/download`}>
              {KIND[e.kind] ?? e.kind}: {e.file_name} ({Math.round(e.size / 1024)} KB)
            </a>
          ))}
        </div>
      )}
      <div className="rounded-lg bg-muted/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold">Yazılı onay kaydı (derin değerlendirme)</p>
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>{open ? "Kapat" : "Onay ekle"}</Button>
        </div>
        <p className="text-[11px] text-muted-foreground">Aktif veya derin kontroller yalnızca, tedarikçinizden aldığınız yazılı onay burada kayıtlıyken ve süresi dolmamışken çalıştırılır.</p>
        {consents.map(c => (
          <div key={c.id} className="text-xs flex items-start justify-between gap-2">
            <div>
              <span className={active(c) ? "text-emerald-400 font-semibold" : "text-muted-foreground"}>{c.revoked_at ? "İptal edildi" : active(c) ? "Geçerli" : "Süresi dolmuş/başlamamış"}</span>
              {" · "}{c.scopes.map(s => labels[s] ?? s).join(", ")}
              <br />{c.signer_name}{c.signer_title ? ` (${c.signer_title})` : ""} · {new Date(c.valid_from).toLocaleDateString("tr-TR")} – {new Date(c.valid_until).toLocaleDateString("tr-TR")}
              {" · "}<a className="text-primary hover:underline" href={`/api/tprm/vendors/${vendorId}/consents/${c.id}/download`}>belge</a>
            </div>
            {active(c) && <button className="text-red-400 shrink-0" onClick={() => revoke(c.id)}>İptal et</button>}
          </div>
        ))}
        {open && (
          <div className="space-y-2 pt-1">
            <div className="space-y-1">
              {Object.entries(labels).map(([k, v]) => (
                <label key={k} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={scopes.includes(k)} onChange={e => setScopes(e.target.checked ? [...scopes, k] : scopes.filter(x => x !== k))} /> {v}
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-md border bg-background px-2 py-1.5 text-sm" placeholder="Onay veren (ad soyad)" value={signer} onChange={e => setSigner(e.target.value)} />
              <input className="rounded-md border bg-background px-2 py-1.5 text-sm" placeholder="Unvanı" value={title} onChange={e => setTitle(e.target.value)} />
              <label className="text-[11px] text-muted-foreground">Başlangıç<input type="date" className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={from} onChange={e => setFrom(e.target.value)} /></label>
              <label className="text-[11px] text-muted-foreground">Bitiş (en fazla 1 yıl)<input type="date" className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" value={until} onChange={e => setUntil(e.target.value)} /></label>
            </div>
            <input type="file" accept="application/pdf,image/png,image/jpeg" className="text-xs" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {err && <p className="text-xs text-red-400">{err}</p>}
            <Button size="sm" disabled={busy} onClick={save}>{busy ? "Kaydediliyor…" : "Kaydet"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
