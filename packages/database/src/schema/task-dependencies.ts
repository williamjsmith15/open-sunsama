import {
  pgTable,
  uuid,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { users } from "./users";
import { tasks } from "./tasks";

/**
 * "Blocker must be done before blocked can start." Edges between a user's
 * tasks; the API refuses edges that would make a cycle. Deleting either
 * task removes the edge.
 */
export const taskDependencies = pgTable(
  "task_dependencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockerTaskId: uuid("blocker_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    blockedTaskId: uuid("blocked_task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("task_dependencies_edge_unique_idx").on(
      table.blockerTaskId,
      table.blockedTaskId
    ),
    index("task_dependencies_blocked_idx").on(table.blockedTaskId),
    index("task_dependencies_user_idx").on(table.userId),
    check(
      "task_dependencies_not_self",
      sql`${table.blockerTaskId} <> ${table.blockedTaskId}`
    ),
  ]
);

export const taskDependenciesRelations = relations(taskDependencies, ({ one }) => ({
  blocker: one(tasks, {
    fields: [taskDependencies.blockerTaskId],
    references: [tasks.id],
    relationName: "blocker",
  }),
  blocked: one(tasks, {
    fields: [taskDependencies.blockedTaskId],
    references: [tasks.id],
    relationName: "blocked",
  }),
}));

export type TaskDependency = typeof taskDependencies.$inferSelect;
