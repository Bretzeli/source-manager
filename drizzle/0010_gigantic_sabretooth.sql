CREATE TABLE "github_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"github_username" text NOT NULL,
	"installation_id" text NOT NULL,
	"selected_repos" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_accounts_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "github_installation_id" TO "github_account_id";--> statement-breakpoint
ALTER TABLE "github_accounts" ADD CONSTRAINT "github_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_accounts" ADD CONSTRAINT "github_accounts_account_id_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_accounts_userId_idx" ON "github_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "github_accounts_accountId_idx" ON "github_accounts" USING btree ("account_id");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_github_account_id_github_accounts_id_fk" FOREIGN KEY ("github_account_id") REFERENCES "public"."github_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_githubAccountId_idx" ON "projects" USING btree ("github_account_id");--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "github_selected_repos";