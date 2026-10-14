ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "estimated_mins_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Existing planned times stay as they are; only new tasks follow their subtasks.
UPDATE "tasks" SET "estimated_mins_manual" = true WHERE "estimated_mins" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN IF NOT EXISTS "subtask_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_subtask_id_subtasks_id_fk" FOREIGN KEY ("subtask_id") REFERENCES "public"."subtasks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "time_blocks_subtask_id_idx" ON "time_blocks" USING btree ("subtask_id");