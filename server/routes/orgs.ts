import { Hono } from "hono";
import { db } from "../db/client";
import { organizations, orgMembers, users } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { authMiddleware, getOrgRole } from "../middleware/auth";

const orgs = new Hono();
orgs.use("*", authMiddleware);

orgs.get("/", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const list = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, role: orgMembers.role, createdAt: organizations.createdAt })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, user.id));
  return c.json(list);
});

orgs.post("/", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const { name } = await c.req.json();
  if (!name?.trim()) return c.json({ error: "Название обязательно" }, 400);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
  const [org] = await db.insert(organizations).values({ name, slug, createdBy: user.id }).returning();
  await db.insert(orgMembers).values({ orgId: org.id, userId: user.id, role: "owner" });
  return c.json(org);
});

orgs.get("/:orgId/members", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const orgId = c.req.param("orgId");
  const role = await getOrgRole(user.id, orgId);
  if (!role) return c.json({ error: "Нет доступа" }, 403);
  const members = await db
    .select({ userId: users.id, email: users.email, name: users.name, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(users, eq(orgMembers.userId, users.id))
    .where(eq(orgMembers.orgId, orgId));
  return c.json(members);
});

orgs.post("/:orgId/invite", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const orgId = c.req.param("orgId");
  const role = await getOrgRole(user.id, orgId);
  if (role !== "owner" && role !== "admin") return c.json({ error: "Нет прав" }, 403);
  const { email, role: newRole } = await c.req.json();
  const invitee = await db.select().from(users).where(eq(users.email, email)).get();
  if (!invitee) return c.json({ error: "Пользователь не найден" }, 404);
  const existing = await db.select().from(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, invitee.id))).get();
  if (existing) return c.json({ error: "Уже участник" }, 409);
  await db.insert(orgMembers).values({ orgId, userId: invitee.id, role: newRole || "viewer" });
  return c.json({ ok: true });
});

orgs.delete("/:orgId/members/:userId", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const orgId = c.req.param("orgId");
  const targetUserId = c.req.param("userId");
  const role = await getOrgRole(user.id, orgId);
  if (role !== "owner" && role !== "admin") return c.json({ error: "Нет прав" }, 403);
  await db.delete(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, targetUserId)));
  return c.json({ ok: true });
});

export default orgs;
