import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, date, index, primaryKey } from "drizzle-orm/pg-core";
import { user } from "./schema";

// Projects table
export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // TODO: logic  to update lastEditedAt when sources/citations/topics change (either via triggers in migration files or application code)
    lastEditedAt: timestamp("last_edited_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("projects_ownerId_idx").on(table.ownerId)]
);

// Topics table
export const topics = pgTable(
  "topics",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    abbreviation: text("abbreviation").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    notes: text("notes"),
  },
  (table) => [index("topics_projectId_idx").on(table.projectId)]
);

// Sources table
export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    abbreviation: text("abbreviation").notNull(),
    title: text("title").notNull(),
    description: text("description"), // unlimited length - using text type
    authors: text("authors"), // storing authors as text (can be comma-separated or JSON)
    publicationDate: date("publication_date"),
    notes: text("notes"), // unlimited length
    links: text("links"), // storing links as text (can be comma-separated or JSON)
    bibtex: text("bibtex"),
  },
  (table) => [index("sources_projectId_idx").on(table.projectId)]
);

// Citations table
export const citations = pgTable("citations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  abbreviation: text("abbreviation").notNull(),
  text: text("text").notNull(),
  notes: text("notes"),
});

// Junction table for Sources - Citations (n:m)
export const sourceCitations = pgTable(
  "source_citations",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    citationId: text("citation_id")
      .notNull()
      .references(() => citations.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.citationId] }),
    index("source_citations_sourceId_idx").on(table.sourceId),
    index("source_citations_citationId_idx").on(table.citationId),
  ]
);

// Junction table for Source - Topics (n:m)
export const sourceTopics = pgTable(
  "source_topics",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    topicId: text("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.topicId] }),
    index("source_topics_sourceId_idx").on(table.sourceId),
    index("source_topics_topicId_idx").on(table.topicId),
  ]
);


// Relations

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(user, {
    fields: [projects.ownerId],
    references: [user.id],
  }),
  sources: many(sources),
  topics: many(topics),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  project: one(projects, {
    fields: [sources.projectId],
    references: [projects.id],
  }),
  citations: many(sourceCitations),
  topics: many(sourceTopics),
}));

export const citationsRelations = relations(citations, ({ many }) => ({
  sources: many(sourceCitations),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  project: one(projects, {
    fields: [topics.projectId],
    references: [projects.id],
  }),
  sources: many(sourceTopics),
}));

export const sourceCitationsRelations = relations(sourceCitations, ({ one }) => ({
  source: one(sources, {
    fields: [sourceCitations.sourceId],
    references: [sources.id],
  }),
  citation: one(citations, {
    fields: [sourceCitations.citationId],
    references: [citations.id],
  }),
}));

export const sourceTopicsRelations = relations(sourceTopics, ({ one }) => ({
  source: one(sources, {
    fields: [sourceTopics.sourceId],
    references: [sources.id],
  }),
  topic: one(topics, {
    fields: [sourceTopics.topicId],
    references: [topics.id],
  }),
}));


