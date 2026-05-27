import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
}

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function usePageMeta({ title, description, ogImage, ogType = "website", noIndex }: PageMeta) {
  useEffect(() => {
    const siteName = "CyberStep.io";
    const fullTitle = title.includes(siteName) ? title : `${title} — ${siteName}`;
    document.title = fullTitle;

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
    }

    setMeta("og:title", fullTitle, "property");
    setMeta("twitter:title", fullTitle);
    setMeta("og:type", ogType, "property");

    if (ogImage) {
      setMeta("og:image", ogImage, "property");
      setMeta("twitter:image", ogImage);
      setMeta("twitter:card", "summary_large_image");
    }

    if (noIndex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      setMeta("robots", "index, follow");
    }
  }, [title, description, ogImage, ogType, noIndex]);
}
