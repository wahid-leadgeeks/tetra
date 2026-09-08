CREATE TABLE "calendar_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"calendar_name" text DEFAULT 'Primary' NOT NULL,
	"sync_enabled" boolean DEFAULT true NOT NULL,
	"category_rules" jsonb,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_configs" ADD CONSTRAINT "calendar_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;