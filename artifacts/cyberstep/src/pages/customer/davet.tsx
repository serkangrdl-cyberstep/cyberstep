import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Copy, Check, Share2, Mail, Users, Trophy, Clock, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface MyCodeData {
  code: string;
  link: string;
  stats: { totalUses: number; totalRewardsGiven: number };
}
interface Stats {
  sent: number;
  registered: number;
  converted: number;
  rewarded: number;
  rewardsEarned: number;
  pending: Array<{ email: string | null; status: string; referredAt: string }>;
}
interface LeaderEntry { rank: number; firstName: string; referrals: number }

const STATUS_LABELS: Record<string, string> = {
  pending: "Kayit bekleniyor",
  registered: "Odeme bekleniyor",
  converted: "Odeme yapildi",
  rewarded: "Odullendirildi",
};
const STATUS_COLORS: Record<string, string> = {
  pending: "text-slate-400",
  registered: "text-yellow-400",
  converted: "text-emerald-400",
  rewarded: "text-emerald-400",
};

export default function DavetPage() {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const { data: codeData } = useQuery<MyCodeData>({
    queryKey: ["referral-my-code"],
    queryFn: () => fetch("/api/referral/my-code", { credentials: "include" }).then(r => r.json()),
  });

  const { data: stats } = useQuery<Stats>({
    queryKey: ["referral-stats"],
    queryFn: () => fetch("/api/referral/stats", { credentials: "include" }).then(r => r.json()),
  });

  const { data: leaderboard } = useQuery<LeaderEntry[]>({
    queryKey: ["referral-leaderboard"],
    queryFn: () => fetch("/api/referral/leaderboard", { credentials: "include" }).then(r => r.json()),
  });

  const inviteMutation = useMutation({
    mutationFn: (email: string) =>
      fetch("/api/referral/send-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      }).then(async r => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Davet gonderilemedi");
        return j;
      }),
    onSuccess: () => {
      toast({ title: "Davet gonderildi", description: `${inviteEmail} adresine davet e-postasi gonderildi.` });
      setInviteEmail("");
    },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  function copyCode() {
    if (!codeData?.code) return;
    navigator.clipboard.writeText(codeData.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    toast({ title: "Kopyalandi", description: "Referral kodunuz panoya kopyalandi." });
  }

  function copyLink() {
    if (!codeData?.link) return;
    navigator.clipboard.writeText(codeData.link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast({ title: "Kopyalandi", description: "Davet linki panoya kopyalandi." });
  }

  function shareWhatsApp() {
    if (!codeData) return;
    const msg = encodeURIComponent(
      `Merhaba! Sirketimizin siber guvenlik riskini olcmek icin kullandigim CyberStep'i deneyelim.\n\nTurkce, 20 dakikada sonuc veriyor. Ilk ayin benden hediye!\n\nKayit: ${codeData.link}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  function shareLinkedIn() {
    if (!codeData) return;
    const url = encodeURIComponent(codeData.link);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, "_blank");
  }

  return (
    <div className="min-h-screen bg-secondary px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Arkadasini Davet Et</h1>
          <p className="text-slate-400 mt-1">Davet et, ikiniz de 1 ay ucretsiz kazan</p>
        </div>

        {/* How it works */}
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="pt-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { step: "1", text: "Davet linkini paylas" },
                { step: "2", text: "Arkadasin kayit olur" },
                { step: "3", text: "Ilk odemeyi yapinca ikiniz de 1 ay ucretsiz" },
              ].map(s => (
                <div key={s.step} className="space-y-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm mx-auto">{s.step}</div>
                  <p className="text-slate-300 text-xs">{s.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Code & Link */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Referral Kodun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 font-mono text-lg text-emerald-400 tracking-widest">
                {codeData?.code ?? "---"}
              </div>
              <Button
                onClick={copyCode}
                variant="outline"
                className="border-slate-600 text-slate-300 hover:text-white px-3"
              >
                {copiedCode ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-1.5">Davet Linki</p>
              <div className="flex gap-2">
                <div className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-xs text-slate-300 truncate">
                  {codeData?.link ?? "---"}
                </div>
                <Button
                  onClick={copyLink}
                  variant="outline"
                  className="border-slate-600 text-slate-300 hover:text-white px-3 shrink-0"
                >
                  {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={shareWhatsApp}
                className="bg-green-600 hover:bg-green-700 text-white text-xs flex-1"
              >
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                WhatsApp'ta Paylas
              </Button>
              <Button
                onClick={shareLinkedIn}
                className="bg-blue-700 hover:bg-blue-800 text-white text-xs flex-1"
              >
                <Share2 className="h-3.5 w-3.5 mr-1.5" />
                LinkedIn'de Paylas
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* E-posta gonder */}
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              E-posta ile Davet Gonder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="arkadasin@sirket.com"
                className="flex-1 bg-slate-800 border border-slate-600 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 placeholder:text-slate-500"
              />
              <Button
                onClick={() => inviteEmail && inviteMutation.mutate(inviteEmail)}
                disabled={!inviteEmail || inviteMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
              >
                <Send className="h-4 w-4 mr-1.5" />
                Gonder
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Gonderilen Davet", value: stats?.sent ?? 0, icon: Mail },
            { label: "Kayit Olan", value: stats?.registered ?? 0, icon: Users },
            { label: "Odeme Yapan", value: stats?.converted ?? 0, icon: Clock },
            { label: "Kazanilan Ay", value: `${stats?.rewardsEarned ?? 0} ay`, icon: Trophy },
          ].map(s => (
            <Card key={s.label} className="bg-slate-900 border-slate-700">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs text-slate-400">{s.label}</span>
                </div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pending invites */}
        {(stats?.pending?.length ?? 0) > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base">Bekleyen Davetler</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats!.pending.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                    <span className="text-slate-300 text-sm">{p.email ?? "-"}</span>
                    <span className={`text-xs ${STATUS_COLORS[p.status] ?? "text-slate-400"}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Leaderboard */}
        {(leaderboard?.length ?? 0) > 0 && (
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-400" />
                Bu Ay En Cok Davet Eden
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaderboard!.map(l => (
                  <div key={l.rank} className="flex items-center gap-3 py-1.5">
                    <span className={`text-sm font-bold w-5 ${l.rank === 1 ? "text-yellow-400" : l.rank === 2 ? "text-slate-300" : l.rank === 3 ? "text-amber-600" : "text-slate-500"}`}>
                      {l.rank}.
                    </span>
                    <span className="text-slate-300 text-sm flex-1">{l.firstName}</span>
                    <span className="text-emerald-400 text-sm font-medium">{l.referrals} davet</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
