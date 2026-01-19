ALTER TABLE "projects" ADD COLUMN "github_access_token" text;--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "github_installation_id";--> statement-breakpoint
ALTER TABLE "projects" DROP COLUMN "github_selected_repos";