# CyberStep — Replit dışı hosting (Railway vb.) için tek servis imajı.
# API + site (artifacts/cyberstep) + marketing paneli (artifacts/digest-admin) aynı süreçte
# sunulur (SERVE_STATIC=true → artifacts/api-server/src/staticSite.ts).
# Replit'teki yayın bu dosyayı kullanmaz.

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
# API sunucusu (esbuild) + iki statik ön yüz (Vite)
RUN pnpm --filter @workspace/api-server run build \
 && PORT=3000 BASE_PATH=/ pnpm --filter @workspace/cyberstep run build \
 && PORT=3000 BASE_PATH=/digest/ pnpm --filter @workspace/digest-admin run build

FROM node:24-bookworm-slim
WORKDIR /app
# PDF raporları DejaVu fontlarını kullanır (Türkçe karakterler)
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# esbuild bazı paketleri harici bırakır (pdfkit, nodemailer, bcryptjs, otplib…);
# bunlar çalışma anında node_modules'tan yüklenir, bu yüzden build çıktısı bütün olarak alınır.
COPY --from=build /app /app
ENV NODE_ENV=production \
    SERVE_STATIC=true \
    PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
