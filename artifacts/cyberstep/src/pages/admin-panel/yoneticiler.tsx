import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRequireAdmin } from "@/hooks/use-admin";
import {
  Plus, Shield, User, Trash2, Key, Check, X, UserCog,
} from "lucide-react";

// Departman listesi — nav section'larla eşleşir
export const DEPARTMENTS = [
  { id: "genel",       label: "Genel Bakış" },
  { id: "musteriler",  label: "Musteriler & Degerlendirme" },
  { id: "satis",       label: "Satis & Gelir" },
  { id: "pazarlama",   label: "Pazarlama & Buyume" },
  { id: "istihbarat",  label: "Istihbarat & Teknografi" },
  { id: "enterprise",  label: "Enterprise & Lead" },
  { id: "ortaklar",    label: "Is Ortaklari & Danismanlik" },
  { id: "icerik",      label: "Icerik & Iletisim" },
  { id: "guvop",       label: "Guvenlik Operasyonlari" },
  { id: "sistem",      label: "Sistem & Ayarlar" },
  { id: "digest",      label: "Digest Yonetim Paneli" },
];

interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  departments: string[];
  isSuperadmin: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function adminFetch(url: string, opts?: RequestInit) {
  return fetch(url, { credentials: "include", ...opts });
}

function DeptBadge({ dept }: { dept: string }) {
  const d = DEPARTMENTS.find(x => x.id === dept);
  return (
    <Badge variant="outline" className="text-xs px-1.5 py-0 border-blue-700 text-blue-400 bg-blue-500/10">
      {d?.label ?? dept}
    </Badge>
  );
}

function DeptCheckbox({
  dept,
  checked,
  onChange,
}: {
  dept: typeof DEPARTMENTS[0];
  checked: boolean;
  onChange: (id: string, val: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(dept.id, !checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors w-full text-left ${
        checked
          ? "border-blue-600 bg-blue-500/15 text-blue-300"
          : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600 hover:text-slate-300"
      }`}
    >
      <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
        checked ? "bg-blue-500 border-blue-500" : "border-slate-600"
      }`}>
        {checked && <Check className="h-3 w-3 text-white" />}
      </div>
      {dept.label}
    </button>
  );
}

function AdminCard({
  admin,
  isSelf,
  onRefresh,
}: {
  admin: AdminUser;
  isSelf: boolean;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [depts, setDepts] = useState<string[]>(admin.departments);
  const [name, setName] = useState(admin.name ?? "");
  const [superadmin, setSuperadmin] = useState(admin.isSuperadmin);
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleDept = (id: string, val: boolean) => {
    setDepts(prev => val ? [...prev, id] : prev.filter(d => d !== id));
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await adminFetch(`/api/admin-panel/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departments: depts, name: name.trim(), isSuperadmin: superadmin }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Kaydedildi" });
      setEditing(false);
      onRefresh();
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const changePw = async () => {
    if (newPw.length < 8) { toast({ title: "Şifre en az 8 karakter", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await adminFetch(`/api/admin-panel/admins/${admin.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPw }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: "Şifre güncellendi" });
      setNewPw(""); setShowPw(false);
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const deleteAdmin = async () => {
    if (!confirm(`${admin.email} silinsin mi? Bu işlem geri alınamaz.`)) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin-panel/admins/${admin.id}`, { method: "DELETE" });
      toast({ title: "Yönetici silindi" });
      onRefresh();
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${admin.isSuperadmin ? "bg-amber-500/15" : "bg-slate-700"}`}>
            {admin.isSuperadmin
              ? <Shield className="h-5 w-5 text-amber-400" />
              : <User className="h-5 w-5 text-slate-400" />
            }
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">{admin.name || admin.email}</span>
              {admin.name && <span className="text-slate-500 text-xs">{admin.email}</span>}
              {isSelf && <Badge variant="outline" className="text-xs px-1.5 py-0 border-slate-600 text-slate-400">Siz</Badge>}
              {admin.isSuperadmin && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-amber-700 text-amber-400 bg-amber-500/10">
                  Süper Admin
                </Badge>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Son giriş: {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString("tr-TR") : "Hiç"}
              {admin.totpEnabled && <span className="ml-2 text-emerald-500">2FA aktif</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline"
            onClick={() => { setEditing(!editing); setDepts(admin.departments); setName(admin.name ?? ""); setSuperadmin(admin.isSuperadmin); }}
            className="border-slate-600 text-slate-400 hover:bg-slate-700 text-xs h-7 px-3">
            <UserCog className="h-3.5 w-3.5 mr-1" />{editing ? "İptal" : "Düzenle"}
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => setShowPw(!showPw)}
            className="border-slate-600 text-slate-400 hover:bg-slate-700 text-xs h-7 px-3">
            <Key className="h-3.5 w-3.5" />
          </Button>
          {!isSelf && (
            <Button size="sm" variant="outline"
              onClick={deleteAdmin} disabled={saving}
              className="border-red-800 text-red-400 hover:bg-red-900/20 text-xs h-7 px-3">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Departmanlar (görüntüleme) */}
      {!editing && !admin.isSuperadmin && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {admin.departments.length === 0
            ? <span className="text-xs text-slate-600">Departman atanmamış</span>
            : admin.departments.map(d => <DeptBadge key={d} dept={d} />)
          }
        </div>
      )}

      {/* Düzenleme paneli */}
      {editing && (
        <div className="mt-4 space-y-4 border-t border-slate-700 pt-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Ad Soyad</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="Yönetici adı" className="bg-slate-900 border-slate-600 text-white text-sm" />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-2 block">Departmanlar</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DEPARTMENTS.map(dept => (
                <DeptCheckbox
                  key={dept.id}
                  dept={dept}
                  checked={depts.includes(dept.id)}
                  onChange={toggleDept}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSuperadmin(!superadmin)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                superadmin
                  ? "border-amber-600 bg-amber-500/15 text-amber-300"
                  : "border-slate-700 text-slate-400 hover:border-slate-600"
              }`}
            >
              <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                superadmin ? "bg-amber-500 border-amber-500" : "border-slate-600"
              }`}>
                {superadmin && <Check className="h-3 w-3 text-white" />}
              </div>
              <Shield className="h-3.5 w-3.5" />
              Supe Admin (her şeye erişim)
            </button>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-4">
              Kaydet
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}
              className="border-slate-600 text-slate-400 text-xs h-8 px-4">
              İptal
            </Button>
          </div>
        </div>
      )}

      {/* Şifre güncelleme */}
      {showPw && (
        <div className="mt-4 border-t border-slate-700 pt-4 flex gap-2">
          <Input
            type="password"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            placeholder="Yeni şifre (min 8 karakter)"
            className="bg-slate-900 border-slate-600 text-white text-sm"
          />
          <Button size="sm" onClick={changePw} disabled={saving}
            className="bg-slate-600 hover:bg-slate-500 text-white text-xs shrink-0">
            Güncelle
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setShowPw(false); setNewPw(""); }}
            className="border-slate-600 text-slate-400 text-xs shrink-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function AdminYoneticiler() {
  const { toast } = useToast();
  const { data: me } = useRequireAdmin();
  const qc = useQueryClient();

  const [showNew, setShowNew] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newName, setNewName] = useState("");
  const [newDepts, setNewDepts] = useState<string[]>([]);
  const [newSuper, setNewSuper] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: admins, isLoading } = useQuery<AdminUser[]>({
    queryKey: ["admin-users"],
    queryFn: () => adminFetch("/api/admin-panel/admins").then(r => {
      if (!r.ok) throw new Error("Erişim reddedildi");
      return r.json();
    }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const createAdmin = async () => {
    if (!newEmail.trim() || !newPw.trim()) {
      toast({ title: "E-posta ve şifre zorunlu", variant: "destructive" }); return;
    }
    setCreating(true);
    try {
      const r = await adminFetch("/api/admin-panel/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail, password: newPw, name: newName,
          departments: newDepts, isSuperadmin: newSuper,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Hata" }));
        toast({ title: err.error ?? "Hata", variant: "destructive" }); return;
      }
      toast({ title: "Yönetici oluşturuldu" });
      setShowNew(false);
      setNewEmail(""); setNewPw(""); setNewName(""); setNewDepts([]); setNewSuper(false);
      invalidate();
    } catch { toast({ title: "Hata", variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const isSuperAdmin = (me as { isSuperadmin?: boolean } | undefined)?.isSuperadmin;

  return (
    <AdminLayout title="Yonetici Yonetimi" description="Departman bazli erisim yetkilerini buradan duzenleyin.">
      <div className="max-w-4xl space-y-6">
        {/* Bilgi kutusu */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-sm text-amber-300">
          <b className="text-amber-200">Departman sistemi:</b> Supe Admin her şeyi görür. Diğer yöneticiler
          yalnızca atandıkları departmanların menü bölümlerini ve ilgili API rotalarını kullanabilir.
          Digest Yönetim Paneli (<code className="bg-black/30 px-1 rounded">digest</code> departmanı) bu sisteme dahildir.
        </div>

        {!isSuperAdmin && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center text-slate-400 text-sm">
            Bu sayfaya yalnızca Supe Adminler erişebilir.
          </div>
        )}

        {isSuperAdmin && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">{admins?.length ?? 0} yönetici</span>
              <Button size="sm" onClick={() => setShowNew(!showNew)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-4">
                <Plus className="h-3.5 w-3.5 mr-1" />Yeni Yonetici
              </Button>
            </div>

            {/* Yeni yönetici formu */}
            {showNew && (
              <div className="bg-slate-800 border border-blue-700/50 rounded-xl p-5 space-y-4">
                <h3 className="text-white font-semibold text-sm">Yeni Yonetici Ekle</h3>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Ad Soyad</label>
                    <Input value={newName} onChange={e => setNewName(e.target.value)}
                      placeholder="Ad Soyad" className="bg-slate-900 border-slate-600 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">E-posta</label>
                    <Input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                      placeholder="ornek@sirket.com" className="bg-slate-900 border-slate-600 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Sifre</label>
                    <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                      placeholder="Min 8 karakter" className="bg-slate-900 border-slate-600 text-white text-sm" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-2 block">Departmanlar</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {DEPARTMENTS.map(dept => (
                      <DeptCheckbox
                        key={dept.id}
                        dept={dept}
                        checked={newDepts.includes(dept.id)}
                        onChange={(id, val) => setNewDepts(prev => val ? [...prev, id] : prev.filter(d => d !== id))}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setNewSuper(!newSuper)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                      newSuper
                        ? "border-amber-600 bg-amber-500/15 text-amber-300"
                        : "border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                      newSuper ? "bg-amber-500 border-amber-500" : "border-slate-600"
                    }`}>
                      {newSuper && <Check className="h-3 w-3 text-white" />}
                    </div>
                    <Shield className="h-3.5 w-3.5" />Supe Admin
                  </button>

                  <Button size="sm" onClick={createAdmin} disabled={creating}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 px-4">
                    {creating ? "Olusturuluyor..." : "Olustur"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowNew(false)}
                    className="border-slate-600 text-slate-400 text-xs h-8 px-4">
                    İptal
                  </Button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-8 text-slate-500 text-sm">Yukleniyor...</div>
            )}

            <div className="space-y-3">
              {admins?.map(admin => (
                <AdminCard
                  key={admin.id}
                  admin={admin}
                  isSelf={admin.id === me?.id}
                  onRefresh={invalidate}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
