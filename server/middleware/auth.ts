import type { Context } from "hono";
import { verify, sign } from "hono/jwt";
import { db } from "../db/client";
import { users, orgMembers } from "../../shared/schema";
import { eq, and } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "vizor-dev-secret-change-in-production";

export async function createToken(userId: string, email: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
  return sign({ sub: userId, email, exp }, JWT_SECRET, "HS256");
}

export async function authMiddleware(c: Context, next: () => Promise<void>) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Не авторизован" }, 401);
  }
  try {
    const token = authHeader.slice(7);
    const payload = (await verify(token, JWT_SECRET, "HS256")) as { sub: string };
    const [user] = await db.select().from(users).where(eq(users.id, payload.sub));
    if (!user) return c.json({ error: "Пользователь не найден" }, 401);
    c.set("user", user);
    await next();
  } catch {
    return c.json({ error: "Недействительный токен" }, 401);
  }
}

export async function getOrgRole(userId: string, orgId: string): Promise<string | null> {
  const member = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    ;
  return member?.role ?? null;
}
