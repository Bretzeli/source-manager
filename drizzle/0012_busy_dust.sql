CREATE TABLE "oauth_account_identity" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_account_identity_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "oauth_account_identity" ADD CONSTRAINT "oauth_account_identity_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_account_identity_email_idx" ON "oauth_account_identity" USING btree ("email");