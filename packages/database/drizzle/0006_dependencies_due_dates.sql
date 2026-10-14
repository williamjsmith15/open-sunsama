CREATE TABLE IF NOT EXISTS "task_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"blocker_task_id" uuid NOT NULL,
	"blocked_task_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_dependencies_not_self" CHECK ("task_dependencies"."blocker_task_id" <> "task_dependencies"."blocked_task_id")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "due_date" date;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_blocker_task_id_tasks_id_fk" FOREIGN KEY ("blocker_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_blocked_task_id_tasks_id_fk" FOREIGN KEY ("blocked_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_dependencies_edge_unique_idx" ON "task_dependencies" USING btree ("blocker_task_id","blocked_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_dependencies_blocked_idx" ON "task_dependencies" USING btree ("blocked_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_dependencies_user_idx" ON "task_dependencies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_user_due_open_idx" ON "tasks" USING btree ("user_id","due_date") WHERE "tasks"."due_date" IS NOT NULL AND "tasks"."completed_at" IS NULL;