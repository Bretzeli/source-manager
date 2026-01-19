ALTER TABLE "projects" ADD COLUMN "github_installation_id" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_selected_repos" text;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "github_access_token";