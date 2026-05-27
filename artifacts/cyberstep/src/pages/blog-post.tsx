import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Calendar, User, ArrowLeft, Clock, Share2, Check } from "lucide-react";
import { format } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import DOMPurify from "dompurify";
import { useLanguage } from "@/contexts/language-context";
import { TRANSLATIONS as T, t } from "@/lib/translations";
import { usePageMeta } from "@/hooks/use-page-meta";

function readingTime(html: string, lang: "tr" | "en"): string {
  const text = html.replace(/<[^>]+>/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return lang === "en" ? `${mins} min read` : `${mins} dk okuma`;
}

interface BlogPost {
  id: number;
  title: string;
  titleEn: string | null;
  slug: string;
  excerpt: string;
  excerptEn: string | null;
  content: string;
  contentEn: string | null;
  socialTextTr: string | null;
  socialTextEn: string | null;
  coverImageBase64: string | null;
  authorName: string;
  publishedAt: string | null;
}

function ShareButtons({ post, lang }: { post: BlogPost; lang: "tr" | "en" }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;
  const socialText = (lang === "en" && post.socialTextEn)
    ? post.socialTextEn
    : (post.socialTextTr ?? ((lang === "en" && post.titleEn) ? post.titleEn : post.title));
  const shareText = `${socialText} ${url}`;

  const open = (href: string) =>
    window.open(href, "_blank", "noopener,noreferrer,width=600,height=500");

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1">
        <Share2 className="h-4 w-4" />
        {lang === "en" ? "Share:" : "Paylas:"}
      </span>

      {/* X (Twitter) */}
      <button
        onClick={() => open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(socialText)}&url=${encodeURIComponent(url)}`)}
        className="p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted transition-colors"
        title="X (Twitter)"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.733-8.835L1.254 2.25H8.08l4.259 5.629L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>

      {/* LinkedIn */}
      <button
        onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)}
        className="p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted transition-colors"
        title="LinkedIn"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      </button>

      {/* WhatsApp */}
      <button
        onClick={() => open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`)}
        className="p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted transition-colors"
        title="WhatsApp"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </button>

      {/* Facebook */}
      <button
        onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
        className="p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted transition-colors"
        title="Facebook"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      </button>

      {/* Instagram — copy text + link to clipboard */}
      <button
        onClick={copyToClipboard}
        className="p-2 rounded-lg border border-border hover:border-primary/40 hover:bg-muted transition-colors"
        title={lang === "en" ? "Copy for Instagram" : "Instagram icin kopyala"}
      >
        {copied ? (
          <Check className="h-4 w-4 text-emerald-500" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        )}
      </button>
      {copied && (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          {lang === "en" ? "Copied!" : "Kopyalandi!"}
        </span>
      )}
    </div>
  );
}

function BlogPostMeta({ post, lang }: { post: BlogPost | null | undefined; lang: "tr" | "en" }) {
  const displayTitle = post ? ((lang === "en" && post.titleEn) ? post.titleEn : post.title) : "Blog";
  const displayExcerpt = post ? ((lang === "en" && post.excerptEn) ? post.excerptEn : post.excerpt) : "";
  usePageMeta({
    title: displayTitle,
    description: displayExcerpt,
    ogImage: post?.coverImageBase64 ?? undefined,
    ogType: "article",
  });
  return null;
}

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";
  const { lang } = useLanguage();

  const { data: post, isLoading, isError } = useQuery<BlogPost>({
    queryKey: ["blog-post", slug],
    queryFn: () => fetch(`/api/public/blog/${slug}`).then(async r => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    enabled: !!slug,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-64 bg-muted rounded-xl" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 bg-muted rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-4">{t(T.blog.notFoundTitle, lang)}</h1>
        <Link href="/blog" className="text-primary hover:underline flex items-center gap-1 justify-center">
          <ArrowLeft className="h-4 w-4" />
          {t(T.blog.notFoundBack, lang)}
        </Link>
      </div>
    );
  }

  const displayTitle = (lang === "en" && post.titleEn) ? post.titleEn : post.title;
  const displayExcerpt = (lang === "en" && post.excerptEn) ? post.excerptEn : post.excerpt;
  const displayContent = (lang === "en" && post.contentEn) ? post.contentEn : post.content;
  const noEnTranslation = lang === "en" && !post.contentEn;

  const clean = typeof window !== "undefined"
    ? DOMPurify.sanitize(displayContent)
    : displayContent;

  const dateLocale = lang === "en" ? enUS : tr;
  const rtLabel = readingTime(displayContent, lang);

  return (
    <article className="max-w-3xl mx-auto px-4 py-16">
      <BlogPostMeta post={post} lang={lang} />

      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
        <ArrowLeft className="h-4 w-4" />
        {t(T.blog.backToAll, lang)}
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold text-foreground leading-tight mb-4">{displayTitle}</h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-6">{displayExcerpt}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground pb-6 border-b border-border flex-wrap">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            {post.authorName}
          </span>
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {format(new Date(post.publishedAt), "d MMMM yyyy", { locale: dateLocale })}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {rtLabel}
          </span>
        </div>
      </header>

      {post.coverImageBase64 && (
        <div className="mb-8 rounded-xl overflow-hidden">
          <img src={post.coverImageBase64} alt={displayTitle} className="w-full max-h-96 object-cover" />
        </div>
      )}

      {noEnTranslation && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-muted text-muted-foreground text-sm border border-border">
          This article has not been translated to English yet. Showing Turkish version.
        </div>
      )}

      <div
        className="prose prose-slate dark:prose-invert prose-lg max-w-none
          prose-headings:font-bold
          prose-p:leading-relaxed
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-xl prose-img:shadow-md
          prose-blockquote:border-primary
          prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded"
        dangerouslySetInnerHTML={{ __html: clean }}
      />

      {/* Share + footer */}
      <div className="mt-12 pt-8 border-t border-border space-y-6">
        <ShareButtons post={post} lang={lang} />
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t(T.blog.backToAll, lang)}
        </Link>
      </div>
    </article>
  );
}
