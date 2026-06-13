import { useQuery } from "@tanstack/react-query";
import { Handshake, Building2, Mail, Phone, User, MessageSquare } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";
import { adminFetchJson } from "@/lib/admin-fetch";

interface PartnerLead {
  id: number;
  leadType: string;
  name: string;
  email: string;
  company: string;
  phone: string | null;
  role: string | null;
  sector: string | null;
  employeeCount: string | null;
  useCase: string | null;
  message: string | null;
  createdAt: string;
}

function fmt(d: string) {
  return new Date(d).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" });
}

export default function IsOrtakligiBaşvurulari() {
  const { data: leads = [], isLoading } = useQuery<PartnerLead[]>({
    queryKey: ["admin-partner-leads"],
    queryFn: () => adminFetchJson<PartnerLead[]>("/api/admin-panel/partner-leads"),
  });

  const partnerLeads = leads.filter(l => l.leadType === "partner");
  const otherLeads = leads.filter(l => l.leadType !== "partner");

  return (
    <AdminLayout title="İş Ortaklığı Başvuruları">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">İş Ortaklığı Başvuruları</h1>
            <p className="text-muted-foreground text-sm mt-1">
              /is-ortakligi sayfasından gelen başvurular + diğer partner lead'ler
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline">{partnerLeads.length} iş ortağı</Badge>
            <Badge variant="secondary">{otherLeads.length} diğer</Badge>
          </div>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Yükleniyor...</p>
        ) : leads.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            <Handshake className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Henüz başvuru yok.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map(lead => (
              <div key={lead.id} className="border rounded-lg p-4 bg-card space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="font-semibold">{lead.company}</span>
                    <Badge variant={lead.leadType === "partner" ? "default" : "secondary"} className="text-xs capitalize">
                      {lead.leadType}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{fmt(lead.createdAt)}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm pl-6">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-3.5 w-3.5" /> {lead.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {lead.email}
                  </span>
                  {lead.phone && (
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" /> {lead.phone}
                    </span>
                  )}
                  {lead.role && (
                    <span className="text-muted-foreground">Tip: {lead.role}</span>
                  )}
                  {lead.useCase && (
                    <span className="col-span-2 text-muted-foreground">{lead.useCase}</span>
                  )}
                  {lead.message && (
                    <span className="col-span-2 flex items-start gap-1.5 text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {lead.message}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
