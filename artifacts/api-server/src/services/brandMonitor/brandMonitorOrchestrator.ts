/**
 * Brand & Typosquatting Monitor Orchestrator
 *
 * Her çalışmada:
 * 1. Aktif/trial müşterilerin primary domain'ini domain_scans üzerinden çeker
 * 2. Her müşteri için typosquat varyasyonları üretir
 * 3. Yeni varyasyonları DNS+HTTP ile kontrol edip brand_monitors'a kaydeder
 * 4. Mevcut ama 7 günden eski kayıtları yeniden kontrol eder
 *
 * Cron: 04:00 Istanbul (blacklist=03:00, ssl=03:15, mail=03:30, reputation=03:45)
 */

import { db, customersTable, domainScansTable, brandMonitorsTable } from "@workspace/db";
import { eq, inArray, lt, or, isNull, and, sql } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { generateVariants } from "./variantGenerator";
import { checkVariantDomain } from "./dnsChecker";
import { calculateSuspicionScore } from "./suspiciousScorer";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const DELAY_MS      = 500;
const MAX_VARIANTS_PER_CUSTOMER = 60;
const MAX_DNS_QUERIES_TOTAL     = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runBrandMonitoring(): Promise<{
  customers_checked: number;
  new_variants: number;
  suspicious_found: number;
}> {
  let customersChecked = 0;
  let newVariants      = 0;
  let suspiciousFound  = 0;
  let totalDnsQueries  = 0;

  // 1. Aktif/trial müşterileri çek
  const customers = await db
    .select({
      id:    customersTable.id,
      email: customersTable.email,
    })
    .from(customersTable)
    .where(
      inArray(customersTable.subscriptionStatus, ["active", "trial"])
    );

  logger.info({ count: customers.length }, "BrandMonitor: müşteri listesi alındı");

  for (const customer of customers) {
    if (totalDnsQueries >= MAX_DNS_QUERIES_TOTAL) {
      logger.warn({ totalDnsQueries }, "BrandMonitor: max DNS limiti aşıldı, durduruluyor");
      break;
    }

    // 2. Müşterinin primary domain'ini domain_scans'tan al (en son tarama)
    const [scanRow] = await db
      .select({ domain: domainScansTable.domain })
      .from(domainScansTable)
      .where(eq(domainScansTable.email, customer.email))
      .orderBy(sql`created_at DESC`)
      .limit(1);

    if (!scanRow?.domain) continue;

    const originalDomain = scanRow.domain;
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);

    // 3. Varyasyon listesi üret
    const variants = generateVariants(originalDomain).slice(0, MAX_VARIANTS_PER_CUSTOMER);

    // 4. brand_monitors'da zaten olan varyasyonları bul
    const existing = await db
      .select({
        variantDomain: brandMonitorsTable.variantDomain,
        lastChecked:   brandMonitorsTable.lastChecked,
      })
      .from(brandMonitorsTable)
      .where(eq(brandMonitorsTable.customerId, customer.id));

    const existingMap = new Map(
      existing.map((r) => [r.variantDomain, r.lastChecked])
    );

    // 5. İşlenecek listesi: yeni VEYA 7 günden eski
    const toProcess = variants.filter((v) => {
      const lastChecked = existingMap.get(v.variant);
      if (!lastChecked) return true;                         // yeni
      return lastChecked < cutoff;                           // eski
    });

    if (toProcess.length === 0) continue;

    customersChecked++;

    for (const v of toProcess) {
      if (totalDnsQueries >= MAX_DNS_QUERIES_TOTAL) break;
      totalDnsQueries++;

      try {
        const dnsResult = await checkVariantDomain(v.variant);
        const { is_suspicious, reason } = calculateSuspicionScore({
          original_domain: originalDomain,
          variant_domain:  v.variant,
          is_active:       dnsResult.is_active,
          http_status:     dnsResult.http_status,
          page_title:      dnsResult.page_title,
          variant_type:    v.type,
        });

        const isNew = !existingMap.has(v.variant);

        if (isNew) {
          // INSERT yeni kayıt
          await db
            .insert(brandMonitorsTable)
            .values({
              customerId:     customer.id,
              originalDomain: originalDomain,
              variantDomain:  v.variant,
              variantType:    v.type,
              isRegistered:   dnsResult.is_registered,
              isActive:       dnsResult.is_active,
              isSuspicious:   is_suspicious,
              httpStatus:     dnsResult.http_status,
              pageTitle:      dnsResult.page_title,
              ipAddress:      dnsResult.ip_address,
              registrar:      dnsResult.registrar,
              firstDetected:  new Date(),
              lastChecked:    new Date(),
            })
            .onConflictDoUpdate({
              target: [brandMonitorsTable.customerId, brandMonitorsTable.variantDomain],
              set: {
                isRegistered: dnsResult.is_registered,
                isActive:     dnsResult.is_active,
                isSuspicious: is_suspicious,
                httpStatus:   dnsResult.http_status,
                pageTitle:    dnsResult.page_title,
                ipAddress:    dnsResult.ip_address,
                lastChecked:  new Date(),
              },
            });

          newVariants++;

          if (is_suspicious) {
            suspiciousFound++;
            logger.warn(
              {
                customerId: customer.id,
                domain:     originalDomain,
                variant:    v.variant,
                type:       v.type,
                reason,
              },
              "BrandMonitor: şüpheli varyasyon tespit edildi"
            );
          }
        } else {
          // UPDATE mevcut kayıt
          await db
            .update(brandMonitorsTable)
            .set({
              isRegistered: dnsResult.is_registered,
              isActive:     dnsResult.is_active,
              isSuspicious: is_suspicious,
              httpStatus:   dnsResult.http_status,
              pageTitle:    dnsResult.page_title,
              ipAddress:    dnsResult.ip_address,
              lastChecked:  new Date(),
            })
            .where(
              and(
                eq(brandMonitorsTable.customerId, customer.id),
                eq(brandMonitorsTable.variantDomain, v.variant)
              )
            );

          if (is_suspicious) {
            suspiciousFound++;
            logger.warn(
              {
                customerId: customer.id,
                domain:     originalDomain,
                variant:    v.variant,
                type:       v.type,
                reason,
              },
              "BrandMonitor: mevcut varyasyon şüpheli duruma geçti"
            );
          }
        }
      } catch (err) {
        logger.warn(
          { customerId: customer.id, variant: v.variant, err },
          "BrandMonitor: varyasyon kontrol hatası"
        );
      }

      await sleep(DELAY_MS);
    }
  }

  logger.info(
    { customersChecked, newVariants, suspiciousFound, totalDnsQueries },
    "BrandMonitor: run tamamlandı"
  );

  return { customers_checked: customersChecked, new_variants: newVariants, suspicious_found: suspiciousFound };
}
