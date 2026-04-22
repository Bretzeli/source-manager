ALTER TABLE "oauth_account_identity" ADD COLUMN "profile_image_url" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "display_email" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "display_image_account_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_display_image_account_id_account_id_fk" FOREIGN KEY ("display_image_account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;