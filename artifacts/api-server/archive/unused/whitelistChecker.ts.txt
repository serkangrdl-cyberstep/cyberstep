import { db } from "@workspace/db";
import { customerIpWhitelistTable } from "@workspace/db";
import { eq, and, isNull, gte, or } from "drizzle-orm";
import { isIPInCIDR, isValidIP } from "./ipUtils";

export async function isWhitelisted(
  ipOrDomain: string,
  customerId: number,
): Promise<{ whitelisted: boolean; matchedRule?: string }> {
  if (!isValidIP(ipOrDomain)) return { whitelisted: false };

  const rules = await db
    .select()
    .from(customerIpWhitelistTable)
    .where(
      and(
        eq(customerIpWhitelistTable.customerId, customerId),
        eq(customerIpWhitelistTable.isActive, true),
        or(
          isNull(customerIpWhitelistTable.expiresAt),
          gte(customerIpWhitelistTable.expiresAt, new Date()),
        ),
      ),
    );

  for (const rule of rules) {
    if (rule.ipCidr === ipOrDomain) {
      return {
        whitelisted: true,
        matchedRule: `${rule.label ?? rule.ipCidr} (${rule.ipCidr})`,
      };
    }
    if (rule.ipCidr.includes("/") && isIPInCIDR(ipOrDomain, rule.ipCidr)) {
      return {
        whitelisted: true,
        matchedRule: `${rule.label ?? rule.ipCidr} (${rule.ipCidr})`,
      };
    }
  }

  return { whitelisted: false };
}
