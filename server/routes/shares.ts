import { Hono } from "hono";
import { db } from "../db/client";
import { datasets, shares, users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { authMiddleware, getOrgRole } from "../middleware/auth";
import { randomBytes } from "node:crypto";

const r = new Hono();

r.post("/datasets/:id/share", authMiddleware, async (c) => {
  const user = c.get("user") as typeof users.$inferSelect;
  const datasetId = c.req.param("id");
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, datasetId));
  if (!ds) return c.json({ error: "Не найдено" }, 404);
  const role = await getOrgRole(user.id, ds.orgId);
  if (!role || role === "viewer") return c.json({ error: "Нет прав" }, 403);
  const [existing] = await db.select().from(shares).where(eq(shares.datasetId, datasetId));
  if (existing) return c.json({ token: existing.token });
  const token = randomBytes(24).toString("hex");
  await db.insert(shares).values({ datasetId, token, createdBy: user.id });
  return c.json({ token });
});

r.get("/shared/:token", async (c) => {
  const token = c.req.param("token");
  const [share] = await db.select().from(shares).where(eq(shares.token, token));
  if (!share) return c.json({ error: "Ссылка недействительна" }, 404);
  if (share.expiresAt && share.expiresAt < new Date()) return c.json({ error: "Ссылка истекла" }, 410);
  const [ds] = await db.select().from(datasets).where(eq(datasets.id, share.datasetId));
  if (!ds) return c.json({ error: "Датасет не найден" }, 404);
  return c.json({ name: ds.name, sourceFilename: ds.sourceFilename, rows: ds.rows, columns: ds.columns, rowCount: ds.rowCount });
});

export default r;
