ALTER TABLE "source_topics" RENAME TO "source_tags";--> statement-breakpoint
ALTER TABLE "topics" RENAME TO "tags";--> statement-breakpoint
ALTER TABLE "source_tags" RENAME COLUMN "topic_id" TO "tag_id";--> statement-breakpoint
ALTER TABLE "source_tags" DROP CONSTRAINT "source_topics_source_id_sources_id_fk";
--> statement-breakpoint
ALTER TABLE "source_tags" DROP CONSTRAINT "source_topics_topic_id_topics_id_fk";
--> statement-breakpoint
ALTER TABLE "tags" DROP CONSTRAINT "topics_project_id_projects_id_fk";
--> statement-breakpoint
DROP INDEX "source_topics_sourceId_idx";--> statement-breakpoint
DROP INDEX "source_topics_topicId_idx";--> statement-breakpoint
DROP INDEX "topics_projectId_idx";--> statement-breakpoint
ALTER TABLE "source_tags" DROP CONSTRAINT "source_topics_source_id_topic_id_pk";--> statement-breakpoint
ALTER TABLE "source_tags" ADD CONSTRAINT "source_tags_source_id_tag_id_pk" PRIMARY KEY("source_id","tag_id");--> statement-breakpoint
ALTER TABLE "source_tags" ADD CONSTRAINT "source_tags_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_tags" ADD CONSTRAINT "source_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_tags_sourceId_idx" ON "source_tags" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "source_tags_tagId_idx" ON "source_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "tags_projectId_idx" ON "tags" USING btree ("project_id");