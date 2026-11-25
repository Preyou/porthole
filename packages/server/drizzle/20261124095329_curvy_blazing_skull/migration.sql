CREATE TABLE "porthole_sessions" (
	"id" text PRIMARY KEY,
	"share_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "porthole_shares" (
	"address" text NOT NULL,
	"created_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"id" text PRIMARY KEY,
	"key_hash" text,
	"listener" text NOT NULL,
	"max_visits" integer,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"port" integer NOT NULL,
	"protocol" text NOT NULL,
	"revoked_at" bigint,
	"slug" text NOT NULL UNIQUE,
	"visits" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "porthole_port_range" CHECK ("port" BETWEEN 50100 AND 50999),
	CONSTRAINT "porthole_visits_valid" CHECK ("visits" >= 0 AND ("max_visits" IS NULL OR "max_visits" > 0))
);
--> statement-breakpoint
CREATE INDEX "porthole_sessions_share_idx" ON "porthole_sessions" ("share_id");--> statement-breakpoint
CREATE INDEX "porthole_shares_owner_created_idx" ON "porthole_shares" ("owner_id","created_at");--> statement-breakpoint
ALTER TABLE "porthole_sessions" ADD CONSTRAINT "porthole_sessions_share_id_porthole_shares_id_fkey" FOREIGN KEY ("share_id") REFERENCES "porthole_shares"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "porthole_shares" ADD CONSTRAINT "porthole_shares_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;