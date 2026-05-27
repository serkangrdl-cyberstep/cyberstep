import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Calendar, User, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import DOMPurify from "dompurify";

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageBase64: string | null;
  authorName: string;
  publishedAt: string | null;
}

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";

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
          <div className="h-8 bg-slate-200 rounded w-3/4" />
          <div className="h-64 bg-slate-200 rounded-xl" />
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="h-4 bg-slate-200 rounded" />)}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Yazi bulunamadi</h1>
        <Link href="/blog" className="text-emerald-600 hover:underline flex items-center gap-1 justify-center">
          <ArrowLeft className="h-4 w-4" />
          Bloga don
        </Link>
      </div>
    );
  }

  const clean = typeof window !== "undefined"
    ? DOMPurify.sanitize(post.content)
    : post.content;

  return (
    <article className="max-w-3xl mx-auto px-4 py-16">
      <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition-colors mb-8">
        <ArrowLeft className="h-4 w-4" />
        Tum yazilar
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4">{post.title}</h1>
        <p className="text-slate-500 text-lg leading-relaxed mb-6">{post.excerpt}</p>
        <div className="flex items-center gap-4 text-sm text-slate-400 pb-6 border-b border-slate-200">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            {post.authorName}
          </span>
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {format(new Date(post.publishedAt), "d MMMM yyyy", { locale: tr })}
            </span>
          )}
        </div>
      </header>

      {post.coverImageBase64 && (
        <div className="mb-8 rounded-xl overflow-hidden">
          <img src={post.coverImageBase64} alt={post.title} className="w-full max-h-96 object-cover" />
        </div>
      )}

      <div
        className="prose prose-slate prose-lg max-w-none
          prose-headings:font-bold prose-headings:text-slate-900
          prose-p:text-slate-600 prose-p:leading-relaxed
          prose-a:text-emerald-600 prose-a:no-underline hover:prose-a:underline
          prose-strong:text-slate-900
          prose-img:rounded-xl prose-img:shadow-md
          prose-blockquote:border-emerald-500 prose-blockquote:text-slate-600
          prose-code:text-emerald-700 prose-code:bg-emerald-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
          prose-ul:text-slate-600 prose-ol:text-slate-600"
        dangerouslySetInnerHTML={{ __html: clean }}
      />

      <div className="mt-12 pt-8 border-t border-slate-200">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Tum yazilar
        </Link>
      </div>
    </article>
  );
}
