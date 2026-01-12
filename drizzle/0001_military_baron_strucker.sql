ALTER TABLE "project_topics" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "project_topics" CASCADE;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "project_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topics_projectId_idx" ON "topics" USING btree ("project_id");