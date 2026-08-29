import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum, primaryKey } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "admin", "viewer"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id").references(() => organizations.id).notNull(),
    userId: uuid("user_id").references(() => users.id).notNull(),
    role: roleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.orgId, t.userId] }) }),
);

export const datasets = pgTable("datasets", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgId: uuid("org_id").references(() => organizations.id).notNull(),
  name: text("name").notNull(),
  sourceFilename: text("source_filename"),
  rows: jsonb("rows").$type<Record<string, unknown>[]>().notNull(),
  columns: jsonb("columns").$type<unknown[]>().notNull(),
  rowCount: integer("row_count").notNull(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const shares = pgTable("shares", {
  id: uuid("id").defaultRandom().primaryKey(),
  datasetId: uuid("dataset_id").references(() => datasets.id).notNull(),
  token: text("token").notNull().unique(),
  createdBy: uuid("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export type User = typeof users.$inferSelect;
export type Organization = typeof organizations.$inferSelect;
export type Dataset = typeof datasets.$inferSelect;
export type Share = typeof shares.$inferSelect;
