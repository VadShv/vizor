import { Hono } from "hono";
import { db } from "../db/client";
import { datasets, users } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware, getOrgRole } from "../middleware/auth";

const r = new Hono();
r.use("*", authMiddleware);

r.get("/", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const orgId = c.req.query("orgId");
  if (!orgId) return c.json({ error: "orgId обязателен" }, 400);
  const role = await getOrgRole(user.id, orgId);
  if (!role) return c.json({ error: "Нет доступа" }, 403);
  const list = await db
    .select({ id: datasets.id, name: datasets.name, sourceFilename: datasets.sourceFilename, rowCount: datasets.rowCount, createdAt: datasets.createdAt, updatedAt: datasets.updatedAt })
    .from(datasets)
    .where(eq(datasets.orgId, orgId))
    .orderBy(desc(datasets.updatedAt));
  return c.json(list);
});

r.post("/", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const body = await c.req.json();
  const { orgId, name, sourceFilename, rows, columns } = body;
  if (!orgId || !name || !rows || !columns) return c.json({ error: "Не хватает данных" }, 400);
  const role = await getOrgRole(user.id, orgId);
  if (!role || role === "viewer") return c.json({ error: "Нет прав" }, 403);
  const [ds] = await db.insert(datasets).values({ orgId, name, sourceFilename: sourceFilename || null, rows, columns, rowCount: rows.length, createdBy: user.id }).returning();
  return c.json({ id: ds.id, name: ds.name, rowCount: ds.rowCount });
});

r.get("/:id", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const id = c.req.param("id");
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!ds) return c.json({ error: "Не найдено" }, 404);
  const role = await getOrgRole(user.id, ds.orgId);
  if (!role) return c.json({ error: "Нет доступа" }, 403);
  return c.json(ds);
});

r.patch("/:id", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const id = c.req.param("id");
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!ds) return c.json({ error: "Не найдено" }, 404);
  const role = await getOrgRole(user.id, ds.orgId);
  if (!role || role === "viewer") return c.json({ error: "Нет прав" }, 403);
  const { name } = await c.req.json();
  const [updated] = await db.update(datasets).set({ name, updatedAt: new Date() }).where(eq(datasets.id, id)).returning();
  return c.json({ id: updated.id, name: updated.name });
});

r.delete("/:id", async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const id = c.req.param("id");
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, id));
  if (!ds) return c.json({ error: "Не найдено" }, 404);
  const role = await getOrgRole(user.id, ds.orgId);
  if (!role || role === "viewer") return c.json({ error: "Нет прав" }, 403);
  await db.delete(datasets).where(eq(datasets.id, id));
  return c.json({ ok: true });
});

export default r;
