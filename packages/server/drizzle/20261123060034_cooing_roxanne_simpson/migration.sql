CREATE TABLE "todos" (
	"id" text PRIMARY KEY,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
	CONSTRAINT "todos_title_valid" CHECK (char_length(btrim("title")) between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
	"issuer" text,
	"subject" text,
	"user_id" text NOT NULL,
	CONSTRAINT "user_identities_pk" PRIMARY KEY("issuer","subject")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"created_at" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY,
	"image" text,
	"name" text,
	"updated_at" bigint DEFAULT (extract(epoch from now()) * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX "todos_owner_created_idx" ON "todos" ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "user_identities_user_idx" ON "user_identities" ("user_id");--> statement-breakpoint
ALTER TABLE "todos" ADD CONSTRAINT "todos_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION yuumi_auth_before_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
    NEW.updated_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER users_before_update BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION yuumi_auth_before_update();

--> statement-breakpoint
CREATE TRIGGER todos_before_update BEFORE UPDATE ON todos FOR EACH ROW EXECUTE FUNCTION yuumi_auth_before_update();
