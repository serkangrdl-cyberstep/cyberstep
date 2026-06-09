import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Calendar, User, ArrowRight, Mail, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";
import { TRANSLATIONS as T, t } from "@/lib/translations";
import { format } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import { usePageMeta } from "@/hooks/use-page-meta";

interface BlogPost {
  id: number;
  title: string;
  titleEn: string | null;
  slug: string;
  excerpt: string;
  excerptEn: string | null;
  coverImageBase64: string | null;
  authorName: string;
  publishedAt: string | null;
  readingMinutesTr: number;
  readingMinutesEn: number;
}

function NewsletterWidget() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [toBlog, setToBlog] = useState(true);
  const [toDigest, setToDigest] = useState(false);
  const { toast } = useToast();
  const { lang } = useLanguage();

  const subscribeMutation = useMutation({
    mutationFn: () =>
      fetch("/api/public/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subscribeToBlog: toBlog, subscribeToDigest: toDigest }),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Hata olustu");
        return data;
      }),
    onSuccess: () => { setSubscribed(true); setEmail(""); },
    onError: (err: Error) => toast({ title: t(T.common.error, lang), description: err.message, variant: "destructive" }),
  });

  if (subscribed) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 flex items-center gap-4">
        <CheckCircle className="h-6 w-6 text-emerald-500 shrink-0" />
        <div>
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">{t(T.blog.subscribedTitle, lang)}</p>
          <p className="text-emerald-600 dark:text-emerald-400 text-sm">{t(T.blog.subscribedSub, lang)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 dark:bg-slate-800 rounded-xl p-6 text-white">
      <div className="flex items-center gap-2 mb-2">
        <Mail className="h-5 w-5 text-emerald-400" />
        <h3 className="font-semibold">{t(T.blog.newsletterTitle, lang)}</h3>
      </div>
      <p className="text-slate-400 text-sm mb-4">{t(T.blog.newsletterSub, lang)}</p>

      {/* Subscription type checkboxes */}
      <div className="space-y-3 mb-5">
        <label
          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${toBlog ? "border-emerald-500/60 bg-emerald-500/10" : "border-slate-700 bg-slate-800/50"}`}
          onClick={() => setToBlog(v => !v)}
        >
          <div className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${toBlog ? "border-emerald-400 bg-emerald-400" : "border-slate-500"}`}>
            {toBlog && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{t(T.blog.subTypeBlog, lang)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t(T.blog.subTypeBlogDesc, lang)}</p>
          </div>
        </label>

        <label
          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${toDigest ? "border-cyan-500/60 bg-cyan-500/10" : "border-slate-700 bg-slate-800/50"}`}
          onClick={() => setToDigest(v => !v)}
        >
          <div className={`mt-0.5 h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${toDigest ? "border-cyan-400 bg-cyan-400" : "border-slate-500"}`}>
            {toDigest && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{t(T.blog.subTypeDigest, lang)}</p>
            <p className="text-xs text-slate-400 mt-0.5">{t(T.blog.subTypeDigestDesc, lang)}</p>
          </div>
        </label>
      </div>

      <div className="flex gap-2">
        <Input
          type="email"
          placeholder={t(T.blog.emailPlaceholder, lang)}
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && email && (toBlog || toDigest) && subscribeMutation.mutate()}
          className="bg-slate-800 dark:bg-slate-700 border-slate-700 dark:border-slate-600 text-white placeholder:text-slate-500 flex-1"
        />
        <Button
          onClick={() => subscribeMutation.mutate()}
          disabled={!email || (!toBlog && !toDigest) || subscribeMutation.isPending}
          className="bg-emerald-500 hover:bg-emerald-400 text-white shrink-0"
        >
          {subscribeMutation.isPending ? "..." : t(T.blog.subscribeBtn, lang)}
        </Button>
      </div>
      {!toBlog && !toDigest && (
        <p className="text-xs text-red-400 mt-2">En az bir secenek secin.</p>
      )}
    </div>
  );
}

export default function Blog() {
  const { lang } = useLanguage();
  usePageMeta({
    title: lang === "en" ? "Cybersecurity Blog | CyberStep.io" : "Siber Güvenlik Blog | CyberStep.io",
    description: lang === "en"
      ? "Latest cybersecurity threats, KVKK news and security tips for businesses in Turkey."
      : "Türkiye'deki şirketler için güncel siber tehditler, KVKK haberleri ve güvenlik önerileri.",
    keywords: lang === "en"
      ? "cybersecurity blog, KVKK news, cyber threats turkey"
      : "siber güvenlik blog, KVKK haberleri, siber tehdit türkiye",
    canonicalPath: "/blog",
    lang,
  });
  const { data: posts, isLoading } = useQuery<BlogPost[]>({
    queryKey: ["public-blog"],
    queryFn: () => fetch("/api/public/blog").then(r => r.json()),
  });

  const dateLocale = lang === "en" ? enUS : tr;

  const getTitle = (p: BlogPost) => (lang === "en" && p.titleEn) ? p.titleEn : p.title;
  const getExcerpt = (p: BlogPost) => (lang === "en" && p.excerptEn) ? p.excerptEn : p.excerpt;

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-12">
        <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-2">{t(T.blog.pageLabel, lang)}</p>
        <h1 className="text-4xl font-bold text-foreground mb-4">{t(T.blog.pageTitle, lang)}</h1>
        <p className="text-muted-foreground text-lg">{t(T.blog.pageSub, lang)}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Post list */}
        <div className="lg:col-span-2">
          {isLoading && (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse border border-border rounded-xl overflow-hidden">
                  <div className="flex">
                    <div className="w-48 h-36 bg-muted shrink-0" />
                    <div className="p-5 flex-1 space-y-3">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-3 bg-muted rounded w-full" />
                      <div className="h-3 bg-muted rounded w-5/6" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && posts?.length === 0 && (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg font-medium mb-2">{t(T.blog.noPostsTitle, lang)}</p>
              <p className="text-sm">{t(T.blog.noPostsSub, lang)}</p>
            </div>
          )}

          <div className="space-y-6">
            {posts?.map(post => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <article className="group border border-border rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/30 cursor-pointer flex flex-col sm:flex-row">
                  {/* Cover image — masaüstünde sol sütun, mobilde üst şerit */}
                  <div className="sm:w-44 sm:shrink-0 h-36 sm:h-auto bg-gradient-to-br from-slate-800 to-emerald-900 relative overflow-hidden">
                    {post.coverImageBase64 ? (
                      <img
                        src={post.coverImageBase64}
                        alt={getTitle(post)}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl font-bold text-emerald-400/20">CS</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 min-w-0 bg-card">
                    <div>
                      <h2 className="font-bold text-foreground text-lg leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2">
                        {getTitle(post)}
                      </h2>
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">{getExcerpt(post)}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {post.authorName}
                        </span>
                        {post.publishedAt && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(post.publishedAt), "d MMM yyyy", { locale: dateLocale })}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {lang === "en"
                            ? `${post.readingMinutesEn} min`
                            : `${post.readingMinutesTr} dk`}
                        </span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
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
          <div className="border border-border rounded-xl p-6 bg-card">
            <h3 className="font-semibold text-foreground mb-3">{t(T.blog.ctaTitle, lang)}</h3>
            <p className="text-muted-foreground text-sm mb-4">{t(T.blog.ctaSub, lang)}</p>
            <Link href="/assessment/start">
              <Button className="w-full bg-emerald-500 hover:bg-emerald-400 text-white">{t(T.blog.ctaBtn, lang)}</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
