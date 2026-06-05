import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminFetchJson } from "@/lib/admin-fetch";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ToggleLeft, ToggleRight, Eye, EyeOff, Calendar, AlertCircle } from "lucide-react";

interface Service {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  isActive: boolean;
  visibility: string;
  passiveReason: string | null;
  passiveSince: string | null;
  roadmapQuarter: string | null;
  monthlyPriceTl: string | null;
  serviceType: string | null;
}

interface DeactivateForm {
  reason: string;
  roadmapQuarter: string;
}

export default function AdminServisYonetimi() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deactivateTarget, setDeactivateTarget] = useState<Service | null>(null);
  const [deactivateForm, setDeactivateForm] = useState<DeactivateForm>({ reason: "", roadmapQuarter: "" });

  const { data: passiveData, isLoading: loadingPassive } = useQuery({
    queryKey: ["/api/admin/services/passive"],
    queryFn: () => adminFetchJson<{ services: Service[] }>("/api/admin/services/passive"),
  });

  const { data: activeData, isLoading: loadingActive } = useQuery({
    queryKey: ["/api/admin/services/active"],
    queryFn: () => adminFetchJson<{ services: Service[] }>("/api/admin/services/active"),
  });

  const activateMutation = useMutation({
    mutationFn: (slug: string) =>
      adminFetchJson(`/api/admin/services/${slug}/activate`, { method: "POST" }),
    onSuccess: (_, slug) => {
      toast({ title: "Servis aktif edildi", description: slug });
      qc.invalidateQueries({ queryKey: ["/api/admin/services/passive"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/services/active"] });
    },
    onError: () => toast({ title: "Hata", description: "Aktivasyon başarısız.", variant: "destructive" }),
  });

  const deactivateMutation = useMutation({
    mutationFn: ({ slug, ...body }: { slug: string; reason: string; roadmapQuarter: string }) =>
      adminFetchJson(`/api/admin/services/${slug}/deactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      toast({ title: "Servis pasife alındı" });
      qc.invalidateQueries({ queryKey: ["/api/admin/services/passive"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/services/active"] });
      setDeactivateTarget(null);
    },
    onError: () => toast({ title: "Hata", description: "Pasife alma başarısız.", variant: "destructive" }),
  });

  function handleDeactivateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deactivateTarget) return;
    deactivateMutation.mutate({
      slug: deactivateTarget.slug,
      reason: deactivateForm.reason,
      roadmapQuarter: deactivateForm.roadmapQuarter,
    });
  }

  const passiveServices = passiveData?.services ?? [];
  const activeServices = activeData?.services ?? [];

  return (
    <AdminLayout title="Servis Yönetimi">
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Servis Yönetimi</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Pasif servisleri takip edin ve aktivasyon durumlarını yönetin.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">Aktif Servisler</p>
            <p className="text-2xl font-bold text-green-600">{activeServices.length}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">Pasif Servisler</p>
            <p className="text-2xl font-bold text-yellow-600">{passiveServices.length}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">Roadmap'te</p>
            <p className="text-2xl font-bold text-blue-600">
              {passiveServices.filter((s) => s.roadmapQuarter).length}
            </p>
          </div>
        </div>

        <Tabs defaultValue="passive">
          <TabsList>
            <TabsTrigger value="passive">
              <EyeOff className="w-4 h-4 mr-1.5" />
              Pasif ({passiveServices.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              <Eye className="w-4 h-4 mr-1.5" />
              Aktif ({activeServices.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="passive" className="mt-4">
            {loadingPassive ? (
              <p className="text-muted-foreground text-sm">Yükleniyor...</p>
            ) : passiveServices.length === 0 ? (
              <p className="text-muted-foreground text-sm">Pasif servis yok.</p>
            ) : (
              <div className="space-y-3">
                {passiveServices.map((svc) => (
                  <div key={svc.slug} className="border rounded-lg p-4 bg-card flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{svc.name}</span>
                        <Badge variant="outline" className="text-xs">{svc.slug}</Badge>
                        {svc.roadmapQuarter && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Calendar className="w-3 h-3" />
                            {svc.roadmapQuarter}
                          </Badge>
                        )}
                      </div>
                      {svc.passiveReason && (
                        <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-yellow-500" />
                          {svc.passiveReason}
                        </p>
                      )}
                      {svc.passiveSince && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Pasife alınma: {new Date(svc.passiveSince).toLocaleDateString("tr-TR")}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => activateMutation.mutate(svc.slug)}
                      disabled={activateMutation.isPending}
                    >
                      <ToggleLeft className="w-4 h-4 mr-1.5" />
                      Aktif Et
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            {loadingActive ? (
              <p className="text-muted-foreground text-sm">Yükleniyor...</p>
            ) : activeServices.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aktif servis yok.</p>
            ) : (
              <div className="space-y-3">
                {activeServices.map((svc) => (
                  <div key={svc.slug} className="border rounded-lg p-4 bg-card flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{svc.name}</span>
                        <Badge variant="outline" className="text-xs">{svc.slug}</Badge>
                        <Badge className="text-xs bg-green-100 text-green-700 border-green-200">Aktif</Badge>
                        {svc.monthlyPriceTl && (
                          <Badge variant="secondary" className="text-xs">
                            ₺{Number(svc.monthlyPriceTl).toLocaleString("tr-TR")}/ay
                          </Badge>
                        )}
                      </div>
                      {svc.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{svc.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDeactivateTarget(svc);
                        setDeactivateForm({ reason: "", roadmapQuarter: "" });
                      }}
                    >
                      <ToggleRight className="w-4 h-4 mr-1.5" />
                      Pasife Al
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Deactivate Dialog */}
      <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Servisi Pasife Al</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDeactivateSubmit} className="space-y-4">
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
              <strong>{deactivateTarget?.name}</strong> ({deactivateTarget?.slug}) pasife alınacak.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="passive-reason">Pasife Alma Nedeni</Label>
              <Textarea
                id="passive-reason"
                placeholder="Neden pasife alınıyor? (opsiyonel)"
                value={deactivateForm.reason}
                onChange={(e) => setDeactivateForm((f) => ({ ...f, reason: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roadmap-quarter">Roadmap Çeyreği</Label>
              <Input
                id="roadmap-quarter"
                placeholder="Q3 2026"
                value={deactivateForm.roadmapQuarter}
                onChange={(e) => setDeactivateForm((f) => ({ ...f, roadmapQuarter: e.target.value }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeactivateTarget(null)}>
                İptal
              </Button>
              <Button type="submit" variant="destructive" disabled={deactivateMutation.isPending}>
                Pasife Al
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
