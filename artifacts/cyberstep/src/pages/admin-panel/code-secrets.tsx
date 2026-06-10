import { useQuery } from "@tanstack/react-query";
import { Code, AlertTriangle, Shield, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminLayout } from "@/components/admin-layout";

interface SecretFinding {
  id: number;
  customerId: number;
  platform: string;
  repoUrl: string;
  repoName: string;
  filePath: string | null;
  secretType: string;
  secretPreview: string | null;
  severity: string;
  isVerified: boolean;
  isRevoked: boolean;
  discoveredAt: string;
  companyName: string | null;
  customerEmail: string;
}

interface Summary {
  total: number;
  critical: number;
  revoked: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-900/40 text-red-300 border-red-700",
  high: "bg-orange-900/40 text-orange-300 border-orange-700",
  medium: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  low: "bg-green-900/40 text-green-300 border-green-700",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Kritik",
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
};

const SECRET_TYPE_LABELS: Record<string, string> = {
  aws_access_key: "AWS Access Key",
  github_token: "GitHub Token",
  stripe_live_key: "Stripe Live Key",
  private_key: "Private Key",
  sendgrid_key: "SendGrid Key",
  jwt_secret: "JWT Secret",
  db_connection: "DB Connection String",
  db_connection_pg: "PostgreSQL Connection",
  generic_api_key: "Generic API Key",
};

export default function AdminCodeSecrets() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-code-secrets"],
    queryFn: async () => {
      const r = await fetch("/api/admin/code-secrets", { credentials: "include" });
      if (!r.ok) throw new Error("Yüklenemedi");
      return r.json() as Promise<{ findings: SecretFinding[]; summary: Summary }>;
    },
  });

  const summary = data?.summary;
  const findings = data?.findings ?? [];

  return (
    <AdminLayout title="Kod Gizli Anahtar Taraması">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Kod Güvenliği (Secrets)</h1>
          <p className="text-gray-400 text-sm mt-1">GitHub repo'larda tespit edilen sızdırılmış kimlik bilgileri.</p>
        </div>

        {/* Özet */}
        {summary && (
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-[#0A1628] border-[#1A2840]">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-white">{summary.total}</p>
                <p className="text-sm text-gray-400">Toplam Bulgu</p>
              </CardContent>
            </Card>
            <Card className={`border-[#1A2840] ${summary.critical > 0 ? "bg-red-900/20" : "bg-[#0A1628]"}`}>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-bold ${summary.critical > 0 ? "text-red-400" : "text-white"}`}>
                  {summary.critical}
                </p>
                <p className="text-sm text-gray-400">Kritik</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0A1628] border-[#1A2840]">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{summary.revoked}</p>
                <p className="text-sm text-gray-400">Revoke Edildi</p>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        ) : findings.length === 0 ? (
          <Card className="bg-[#0A1628] border-[#1A2840]">
            <CardContent className="py-12 text-center text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-2 text-green-400" />
              Henüz tespit edilen secret yok.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {findings.map(f => (
              <Card key={f.id} className="bg-[#0A1628] border-[#1A2840]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded border ${SEVERITY_COLORS[f.severity] ?? SEVERITY_COLORS.medium}`}>
                          {SEVERITY_LABELS[f.severity] ?? f.severity}
                        </span>
                        <span className="font-medium text-white">{SECRET_TYPE_LABELS[f.secretType] ?? f.secretType}</span>
                        {f.isRevoked && (
                          <span className="text-xs px-2 py-0.5 rounded border bg-green-900/40 text-green-300 border-green-700">
                            Revoke Edildi
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap mt-1">
                        <span>{f.companyName ?? f.customerEmail}</span>
                        <span>·</span>
                        <a
                          href={f.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          {f.repoName} <ExternalLink className="w-3 h-3" />
                        </a>
                        {f.filePath && <span>· {f.filePath}</span>}
                        {f.secretPreview && (
                          <code className="font-mono text-yellow-400/80 bg-[#060D1A] px-1 rounded">
                            {f.secretPreview}
                          </code>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Tespit: {new Date(f.discoveredAt).toLocaleDateString("tr-TR")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
