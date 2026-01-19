ALTER TABLE "projects" RENAME COLUMN "github_access_token" TO "github_installation_id";--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "github_selected_repos" text;