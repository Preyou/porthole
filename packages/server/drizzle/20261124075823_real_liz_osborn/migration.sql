CREATE TABLE "local_accounts" (
	"password_hash" text NOT NULL,
	"user_id" text NOT NULL UNIQUE,
	"username" text PRIMARY KEY
);
--> statement-breakpoint
ALTER TABLE "local_accounts" ADD CONSTRAINT "local_accounts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;