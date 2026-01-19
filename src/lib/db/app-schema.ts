import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, date, index, primaryKey, boolean } from "drizzle-orm/pg-core";
import { user, account } from "./schema";

// GitHub Accounts table - stores GitHub App installations linked to user accounts
export const githubAccounts = pgTable(
  "github_accounts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => account.id, { onDelete: "set null" }), // Link to better-auth account table (the GitHub OAuth account they logged in with)
    githubUsername: text("github_username").notNull(), // GitHub username for display
    installationId: text("installation_id").notNull().unique(), // GitHub App installation ID
    selectedRepos: text("selected_repos"), // JSON array of repository full names user granted access to (e.g., ["owner/repo1"])
    isPrimary: boolean("is_primary").default(false).notNull(), // Is this the account the user logged in with?
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("github_accounts_userId_idx").on(table.userId),
    index("github_accounts_accountId_idx").on(table.accountId),
  ]
);

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
    githubRepoUrl: text("github_repo_url"), // GitHub repository URL (e.g., https://github.com/owner/repo)
    githubRepoFiles: text("github_repo_files"), // JSON array of selected file paths to check for citations
    githubAccountId: text("github_account_id").references(() => githubAccounts.id, { onDelete: "set null" }), // Reference to the GitHub account to use for this project
    createdAt: timestamp("created_at").defaultNow().notNull(),
    // TODO: logic  to update lastEditedAt when sources/citations/tags change (either via triggers in migration files or application code)
    lastEditedAt: timestamp("last_edited_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("projects_ownerId_idx").on(table.ownerId),
    index("projects_githubAccountId_idx").on(table.githubAccountId),
  ]
);

// Tags table
export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    abbreviation: text("abbreviation"), // Optional
    name: text("name").notNull(),
    description: text("description"),
    notes: text("notes"),
    color: text("color").default("#3b82f6").notNull(), // Default blue color
  },
  (table) => [index("tags_projectId_idx").on(table.projectId)]
);

// Sources table
export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    abbreviation: text("abbreviation"), // Optional
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

// Junction table for Source - Tags (n:m)
export const sourceTags = pgTable(
  "source_tags",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.tagId] }),
    index("source_tags_sourceId_idx").on(table.sourceId),
    index("source_tags_tagId_idx").on(table.tagId),
  ]
);


// Relations

export const githubAccountsRelations = relations(githubAccounts, ({ one, many }) => ({
  user: one(user, {
    fields: [githubAccounts.userId],
    references: [user.id],
  }),
  account: one(account, {
    fields: [githubAccounts.accountId],
    references: [account.id],
  }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(user, {
    fields: [projects.ownerId],
    references: [user.id],
  }),
  githubAccount: one(githubAccounts, {
    fields: [projects.githubAccountId],
    references: [githubAccounts.id],
  }),
  sources: many(sources),
  tags: many(tags),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  project: one(projects, {
    fields: [sources.projectId],
    references: [projects.id],
  }),
  citations: many(sourceCitations),
  tags: many(sourceTags),
}));

export const citationsRelations = relations(citations, ({ many }) => ({
  sources: many(sourceCitations),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  project: one(projects, {
    fields: [tags.projectId],
    references: [projects.id],
  }),
  sources: many(sourceTags),
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

export const sourceTagsRelations = relations(sourceTags, ({ one }) => ({
  source: one(sources, {
    fields: [sourceTags.sourceId],
    references: [sources.id],
  }),
  tag: one(tags, {
    fields: [sourceTags.tagId],
    references: [tags.id],
  }),
}));


