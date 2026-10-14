import {
  pgTable,
  uuid,
  varchar,
  text,
  date,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

/**
 * Projects group tasks. Flat (no nesting) and owned by one user. A task
 * belongs to at most one project through `tasks.project_id`; deleting a
 * project leaves its tasks in place, unassigned.
 */

export const PROJECT_STATUSES = [
  "active",
  "on_hold",
  "completed",
  "archived",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    /** hex color from the shared COLOR_OPTIONS palette */
    color: varchar("color", { length: 7 }).notNull().default("#6366F1"),
    /** lucide-react icon name */
    icon: varchar("icon", { length: 64 }).notNull().default("Folder"),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    /** Optional date the project should be finished by */
    targetDate: date("target_date"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("projects_user_idx").on(table.userId, table.position)]
);

export const projectsRelations = relations(projects, ({ one }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
}));

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
