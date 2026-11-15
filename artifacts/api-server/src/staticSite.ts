/**
 * Tek sunucuda site + marketing paneli sunumu (Replit dışı hosting için, ör. Railway).
 *
 * Replit'te site (artifacts/cyberstep) ve marketing paneli (artifacts/digest-admin)
 * ayrı statik servislerdir; Replit'in yönlendiricisi /api'yi bu sunucuya, /digest/'i
 * panele, geri kalanı siteye gönderir. Replit dışında aynı yönlendirmeyi bu modül yapar.
 * Yalnızca SERVE_STATIC=true iken devreye girer; Replit'teki davranış değişmez.
 */
import path from "node:path";
import fs from "node:fs";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { logger } from "./lib/logger";

// Site ve panel için ayrı CSP: API'nin "her şeyi yasakla" CSP'si HTML sayfalarını bozar.
const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https:",
  "frame-src 'self' https://www.youtube.com https://www.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function siteHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("Content-Security-Policy", SITE_CSP);
  // Görseller/fontlar başka sitelere gömülebilsin (ör. güven rozeti görseli)
  res.removeHeader("Cross-Origin-Resource-Policy");
  next();
}

function mountSpa(app: Express, urlPrefix: string, dir: string) {
  const indexHtml = path.join(dir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    logger.warn({ dir }, "Statik site klasörü bulunamadı, atlanıyor");
    return false;
  }
  // Hash'li varlıklar uzun süre önbelleklenir; index.html hiç önbelleklenmez
  app.use(urlPrefix, siteHeaders, express.static(dir, {
    index: false,
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));
  // SPA geri dönüşü: bu önekteki bilinmeyen GET/HEAD istekleri index.html'e.
  // (Express 5'te "*" yol deseni geçersiz; ara katmanla yapılır.)
  const prefix = urlPrefix === "/" ? "" : urlPrefix;
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api/") || req.path === "/api") return next();
    if (prefix && req.path !== prefix && !req.path.startsWith(prefix + "/")) return next();
    siteHeaders(req, res, () => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexHtml);
    });
  });
  return true;
}

export function mountStaticSite(app: Express): void {
  if (process.env["SERVE_STATIC"] !== "true") return;
  const root = process.env["STATIC_ROOT"] ?? process.cwd();
  // www → çıplak alan adı (SEO için tek kanonik adres). API rotaları bundan önce
  // kayıtlı olduğu için yalnızca eşleşmeyen GET/HEAD istekleri buraya düşer.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method === "GET" || req.method === "HEAD") && /^www\./i.test(req.hostname)) {
      res.redirect(301, `https://${req.hostname.replace(/^www\./i, "")}${req.originalUrl}`);
      return;
    }
    next();
  });
  // Sıra önemli: önce /digest (panel), sonra / (site)
  const panel = mountSpa(app, "/digest", path.join(root, "artifacts/digest-admin/dist/public"));
  const site = mountSpa(app, "/", path.join(root, "artifacts/cyberstep/dist/public"));
  logger.info({ root, panel, site }, "Statik site sunumu etkin (SERVE_STATIC=true)");
}
