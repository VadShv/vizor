import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../db/client";
import { users, organizations, orgMembers } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { createToken, authMiddleware } from "../middleware/auth";

const auth = new Hono();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, "Минимум 6 символов"),
  name: z.string().min(1),
});

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "org";
}

auth.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.issues[0].message }, 400);
  const { email, password, name } = parsed.data;
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return c.json({ error: "Email уже зарегистрирован" }, 409);
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning();
  const slug = slugify(name) + "-" + user.id.slice(0, 8);
  const [org] = await db.insert(organizations).values({ name: name + " — workspace", slug, createdBy: user.id }).returning();
  await db.insert(orgMembers).values({ orgId: org.id, userId: user.id, role: "owner" });
  const token = createToken(user.id, user.email);
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

auth.post("/login", async (c) => {
  const body = await c.req.json();
  const { email, password } = body;
  if (!email || !password) return c.json({ error: "Неверный email или пароль" }, 400);
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return c.json({ error: "Неверный email или пароль" }, 401);
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return c.json({ error: "Неверный email или пароль" }, 401);
  const token = createToken(user.id, user.email);
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, token });
});

auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const orgsList = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, user.id));
  return c.json({ user: { id: user.id, email: user.email, name: user.name }, orgs: orgsList });
});

auth.post("/logout", (c) => c.json({ ok: true }));

export default auth;
