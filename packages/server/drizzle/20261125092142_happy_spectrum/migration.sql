CREATE TABLE "logto_account_revocations" (
	"provider" text,
	"revoked_before" bigint NOT NULL,
	"state" text,
	"state_changed_at" bigint NOT NULL,
	"subject" text,
	CONSTRAINT "logto_account_revocations_pk" PRIMARY KEY("provider","subject")
);
