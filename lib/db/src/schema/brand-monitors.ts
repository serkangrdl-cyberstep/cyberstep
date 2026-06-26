import {
  pgTable, serial, integer, varchar, boolean,
  timestamp, date, index, unique,
} from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const brandMonitorsTable = pgTable("brand_monitors", {
  id:             serial("id").primaryKey(),
  customerId:     integer("customer_id").references(() => customersTable.id),
  originalDomain: varchar("original_domain", { length: 255 }).notNull(),
  variantDomain:  varchar("variant_domain",  { length: 255 }).notNull(),
  variantType:    varchar("variant_type",    { length: 50  }).notNull(),
  // 'typo_char_swap' | 'typo_missing_char' | 'typo_double_char' |
  // 'tld_swap' | 'hyphen_add' | 'hyphen_remove' | 'homoglyph' |
  // 'prefix_add' | 'suffix_add'

  isRegistered: boolean("is_registered").default(false),
  isActive:     boolean("is_active").default(false),
  // is_active: DNS A veya MX kaydı var mı
  isSuspicious: boolean("is_suspicious").default(false),
  // is_suspicious: aktif VE içerik analizi şüpheli

  httpStatus: integer("http_status"),
  // aktifse HTTP status kodu
  pageTitle:  varchar("page_title", { length: 500 }),
  // aktifse sayfa başlığı
  ipAddress:        varchar("ip_address",       { length: 45  }),
  registrar:        varchar("registrar",        { length: 255 }),
  registeredDate:   date("registered_date"),

  firstDetected: timestamp("first_detected").defaultNow(),
  lastChecked:   timestamp("last_checked").defaultNow(),
}, (t) => [
  unique("brand_monitors_customer_domain_uq").on(t.customerId, t.variantDomain),
  index("idx_brand_monitors_customer").on(t.customerId),
  index("idx_brand_monitors_suspicious").on(t.isSuspicious),
]);

export type BrandMonitor = typeof brandMonitorsTable.$inferSelect;
export type NewBrandMonitor = typeof brandMonitorsTable.$inferInsert;
