import { useEffect } from "react";

interface PageMeta {
  title: string;
  description?: string;
  ogImage?: string;
  ogType?: string;
  noIndex?: boolean;
  canonicalPath?: string;
  lang?: "tr" | "en";
}

const BASE_URL = "https://cyberstep.io";

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string, extraAttrs?: Record<string, string>) {
  const selector = extraAttrs
    ? `link[rel="${rel}"][hreflang="${extraAttrs["hreflang"] ?? ""}"]`
    : `link[rel="${rel}"]`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    if (extraAttrs) {
      for (const [k, v] of Object.entries(extraAttrs)) el.setAttribute(k, v);
    }
    document.head.appendChild(el);
  }
  el.href = href;
}

export function usePageMeta({
  title,
  description,
  ogImage,
  ogType = "website",
  noIndex,
  canonicalPath,
  lang = "tr",
}: PageMeta) {
  useEffect(() => {
    const siteName = "CyberStep.io";
    const fullTitle = title.includes(siteName) ? title : `${title} — ${siteName}`;
    document.title = fullTitle;

    const canonicalUrl = canonicalPath
      ? `${BASE_URL}${canonicalPath}`
      : `${BASE_URL}${window.location.pathname}`;

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description, "property");
      setMeta("twitter:description", description);
    }

    setMeta("og:title", fullTitle, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:url", canonicalUrl, "property");
    setMeta("og:site_name", siteName, "property");
    setMeta("og:locale", lang === "tr" ? "tr_TR" : "en_US", "property");

    setMeta("twitter:title", fullTitle);

    if (ogImage) {
      setMeta("og:image", ogImage, "property");
      setMeta("twitter:image", ogImage);
      setMeta("twitter:card", "summary_large_image");
    }

    // Canonical URL
    setLink("canonical", canonicalUrl);

    // hreflang — TR ve EN versiyonları Google'a bildir
    setLink("alternate", canonicalUrl, { hreflang: "tr" });
    setLink("alternate", canonicalUrl, { hreflang: "en" });
    setLink("alternate", canonicalUrl, { hreflang: "x-default" });

    if (noIndex) {
      setMeta("robots", "noindex, nofollow");
    } else {
      setMeta("robots", "index, follow");
    }
  }, [title, description, ogImage, ogType, noIndex, canonicalPath, lang]);
}
