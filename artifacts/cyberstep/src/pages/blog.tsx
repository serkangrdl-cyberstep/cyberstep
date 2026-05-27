import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Calendar, User, ArrowRight, Mail, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  coverImageBase64: string | null;
  authorName: string;
  publishedAt: string | null;
}

function NewsletterWidget() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const { toast } = useToast();

  const subscribeMutation = useMutation({
    mutationFn: (email: string) =>
      fetch("/api/public/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Hata olustu");
        return data;
      }),
    onSuccess: () => { setSubscribed(true); setEmail(""); },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  if (subscribed) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-4">
        <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-800">Abone oldunuz</p>
          <p className="text-emerald-600 text-sm">Yeni yazi yayinlandiginda e-posta alacaksiniz.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 rounded-xl p-6 text-white">
      <div className="flex items-center gap-2 mb-3">
        <Mail className="h-5 w-5 text-emerald-400" />
        <h3 className="font-semibold">Bultene Abone Ol</h3>
      </div>
      <p className="text-slate-400 text-sm mb-4">Yeni blog yazilari e-postaniza gelsin. Istediginiz zaman abonelikten cikabilirsiniz.</p>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="e-posta@sirket.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && email && subscribeMutation.mutate(email)}
          className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 flex-1"
        />
        <Button
          onClick={() => subscribeMutation.mutate(email)}
          disabled={!email || subscribeMutation.isPending}
          className="bg-emerald-500 hover:bg-emerald-400 text-white shrink-0"
        >
          {subscribeMutation.isPending ? "..." : "Abone Ol"}
        </Button>
      </div>
    </div>
  );
}

export default function Blog() {
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["public-blog"],
    queryFn: () => fetch("/api/public/blog").then(r => r.json()),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-12">
        <p className="text-emerald-600 text-sm font-semibold uppercase tracking-wider mb-2">Blog</p>
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Siber Guvenlik Rehberi</h1>
        <p className="text-slate-500 text-lg">KOBIler icin siber guvenlik ipuclari, guncel tehditler ve koruma stratejileri.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Post list */}
        <div className="lg:col-span-2">
          {isLoading && (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse border border-slate-200 rounded-xl overflow-hidden">
                  <div className="flex">
                    <div className="w-48 h-36 bg-slate-200 shrink-0" />
                    <div className="p-5 flex-1 space-y-3">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-full" />
                      <div className="h-3 bg-slate-200 rounded w-5/6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && posts?.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <p className="text-lg font-medium mb-2">Henuz yazi yok</p>
              <p className="text-sm">Yakinlarda yeni icerikler yayinlanacak.</p>
            </div>
          )}

          <div className="space-y-6">
            {posts?.map(post => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="group border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 hover:border-emerald-200 cursor-pointer flex">
                  {/* Cover image */}
                  <div className="w-48 shrink-0 bg-gradient-to-br from-slate-800 to-emerald-900 relative overflow-hidden">
                    {post.coverImageBase64 ? (
                      <img
                        src={post.coverImageBase64}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl font-bold text-emerald-400/30">CS</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex flex-col justify-between flex-1 min-h-[144px]">
                    <div>
                      <h2 className="font-bold text-slate-900 text-lg leading-tight mb-2 group-hover:text-emerald-700 transition-colors line-clamp-2">
                        {post.title}
                      </h2>
                      <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">{post.excerpt}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {post.authorName}
                        </span>
                        {post.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(post.publishedAt), "d MMM yyyy", { locale: tr })}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <NewsletterWidget />
          <div className="border border-slate-200 rounded-xl p-6">
            <h3 className="font-semibold text-slate-900 mb-3">Ucretsiz Risk Analizi</h3>
            <p className="text-slate-500 text-sm mb-4">Sirketinizin siber guvenlik risklerini 20 soruyla analiz edin.</p>
            <Link href="/assessment/start">
              <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white">Hemen Baslat</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
