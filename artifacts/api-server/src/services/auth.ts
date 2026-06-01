import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { adminUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

async function getAuthenticator(): Promise<unknown> {
  const otplib = await import("otplib") as unknown as Record<string, unknown> & { default?: Record<string, unknown> };
  return otplib["authenticator"] ?? otplib.default?.["authenticator"];
}

export async function createAdminUser(email: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 12);
  await db.insert(adminUsersTable).values({ email, passwordHash: hash });
  logger.info({ email }, "Admin user created");
}

export async function verifyAdminPassword(email: string, password: string) {
  const [user] = await db.select().from(adminUsersTable).where(eq(adminUsersTable.email, email));
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

export async function generateTotpSecret(): Promise<string> {
  const auth = await getAuthenticator() as { generateSecret: () => string };
  return auth.generateSecret();
}

export async function generateTotpQrUrl(email: string, secret: string): Promise<string> {
  const auth = await getAuthenticator() as { keyuri: (email: string, service: string, secret: string) => string };
  return auth.keyuri(email, "CyberStep.io", secret);
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  const auth = await getAuthenticator() as { verify: (opts: { token: string; secret: string }) => boolean };
  return auth.verify({ token, secret });
}

export async function enableTotp(userId: number, secret: string): Promise<void> {
  await db.update(adminUsersTable)
    .set({ totpSecret: secret, totpEnabled: true })
    .where(eq(adminUsersTable.id, userId));
}

export async function updateLastLogin(userId: number): Promise<void> {
  await db.update(adminUsersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(adminUsersTable.id, userId));
}
