import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Calendar, User, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import DOMPurify from "dompurify";
import { useLanguage } from "@/contexts/language-context";
import { TRANSLATIONS as T, t } from "@/lib/translations";

interface BlogPost {
  id: number;
  title: string;
  titleEn: string | null;
  slug: string;
  excerpt: string;
  excerptEn: string | null;
  content: string;
  contentEn: string | null;
  coverImageBase64: string | null;
  authorName: string;
  publishedAt: string | null;
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
            {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-muted rounded" />)}
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

  return (
    <article className="max-w-3xl mx-auto px-4 py-16">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
        <ArrowLeft className="h-4 w-4" />
        {t(T.blog.backToAll, lang)}
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold text-foreground leading-tight mb-4">{displayTitle}</h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-6">{displayExcerpt}</p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground pb-6 border-b border-border">
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

      <div className="mt-12 pt-8 border-t border-border">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {t(T.blog.backToAll, lang)}
        </Link>
      </div>
    </article>
  );
}
