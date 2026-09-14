ALTER TABLE "tasks" ADD COLUMN "status" text DEFAULT 'todo' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "description" text;