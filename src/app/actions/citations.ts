"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { projects, githubAccounts, sources, sourceTags, tags } from "@/lib/db/app-schema"
import { eq, inArray, asc } from "drizzle-orm"
import { headers } from "next/headers"
import { getInstallationToken } from "@/lib/github-app"

/**
 * Parse GitHub repository URL to owner/repo format
 */
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    const patterns = [
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/\.]+)(?:\.git)?\/?$/,
      /^git@github\.com:([^\/]+)\/([^\/\.]+)(?:\.git)?$/,
      /^([^\/]+)\/([^\/]+)$/,
    ]
    
    for (const pattern of patterns) {
      const match = url.trim().match(pattern)
      if (match) {
        return { owner: match[1], repo: match[2] }
      }
    }
    
    return null
  } catch {
    return null
  }
}

function buildGithubHeaders(accessToken: string | null): HeadersInit {
  return {
    Accept: "application/vnd.github.v3+json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  }
}

async function fetchDefaultBranch(owner: string, repo: string, accessToken: string | null): Promise<string> {
  const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers: buildGithubHeaders(accessToken),
  })

  if (!repoResponse.ok) {
    throw new Error(`Failed to fetch repository: ${repoResponse.statusText}`)
  }

  const repoData = await repoResponse.json()
  return repoData.default_branch
}

async function fetchFileContent(
  owner: string,
  repo: string,
  filePath: string,
  defaultBranch: string,
  accessToken: string | null
): Promise<string> {
  const fileResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=${defaultBranch}`,
    { headers: buildGithubHeaders(accessToken) }
  )

  if (!fileResponse.ok) {
    throw new Error(`Failed to fetch file: ${fileResponse.statusText}`)
  }

  const fileData = await fileResponse.json()

  if (fileData.encoding === "base64") {
    return Buffer.from(fileData.content, "base64").toString("utf-8")
  }

  return fileData.content || ""
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (true) {
      const currentIndex = index++
      if (currentIndex >= items.length) return
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length))
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

/**
 * Parse LaTeX citations from file content
 * Returns both individual citations and unique citation commands
 * Supports: \cite, \parencite, \parencites, \textcite, \footcite, \autocite, etc.
 */
function parseLatexCitations(content: string): {
  citations: string[]
  uniqueCitationCommands: number
} {
  const citations: string[] = []
  let uniqueCitationCommands = 0
  
  // Pattern to match various citation commands
  // Matches: \cite{key}, \parencite{key}, \textcite{key}, etc.
  // Also handles multiple citations: \cite{key1,key2,key3}
  const citationPattern = /\\(?:cite|parencite|parencites|textcite|footcite|autocite|fullcite|citeauthor|citeyear|citep|citet|footfullcite)\*?(?:\[[^\]]*\])?\{([^}]+)\}/g
  
  let match
  while ((match = citationPattern.exec(content)) !== null) {
    uniqueCitationCommands++ // Each citation command counts as one unique citation
    const citationContent = match[1]
    // Split by comma and trim each citation key
    const keys = citationContent.split(",").map((key) => key.trim())
    citations.push(...keys) // Each key counts as a separate citation
  }
  
  return { citations, uniqueCitationCommands }
}

/**
 * Count sentences in LaTeX content
 * Handles lists and table cells specially
 */
function countSentences(content: string): number {
  let sentenceCount = 0
  
  // Extract and process list environments
  const listPattern = /\\begin\{((?:itemize|enumerate|description))\}([\s\S]*?)\\end\{\1\}/g
  const listMatches: Array<{ start: number; end: number; content: string }> = []
  
  let listMatch
  while ((listMatch = listPattern.exec(content)) !== null) {
    listMatches.push({
      start: listMatch.index,
      end: listMatch.index + listMatch[0].length,
      content: listMatch[2],
    })
  }
  
  // Process list content
  for (const list of listMatches) {
    // For lists: count \item as one sentence each (if no dot in item)
    // Use [\s\S] instead of . with s flag for ES2017 compatibility
    const itemPattern = /\\item\s*([^\\]*?)(?=\\item|\\end|$)/g
    let itemMatch
    while ((itemMatch = itemPattern.exec(list.content)) !== null) {
      let itemText = itemMatch[1]
      // Remove LaTeX commands from item text
      itemText = itemText.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})*/g, '')
      itemText = itemText.replace(/\{[^}]*\}/g, '')
      itemText = itemText.trim()
      
      if (itemText.length === 0) continue
      
      // If item has a dot, count sentences normally
      if (itemText.includes('.')) {
        const sentences = itemText.split(/\.\s+/).filter(s => s.trim().length > 0)
        sentenceCount += sentences.length
      } else {
        // No dot, count as one sentence
        sentenceCount += 1
      }
    }
  }
  
  // Extract and process table environments
  const tablePattern = /\\begin\{((?:tabular|table|longtable))\}([\s\S]*?)\\end\{\1\}/g
  const tableMatches: Array<{ start: number; end: number; content: string }> = []
  
  let tableMatch
  while ((tableMatch = tablePattern.exec(content)) !== null) {
    tableMatches.push({
      start: tableMatch.index,
      end: tableMatch.index + tableMatch[0].length,
      content: tableMatch[2],
    })
  }
  
  // Process table content
  for (const table of tableMatches) {
    // For tables: count cells (separated by &) as sentences if no dot
    const rows = table.content.split(/\\\\/).filter(r => r.trim().length > 0)
    for (const row of rows) {
      // Split by & but handle escaped &
      const cells = row.split(/(?<!\\)&/).map(c => {
        // Remove LaTeX commands
        let cell = c.replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})*/g, '')
        cell = cell.replace(/\{[^}]*\}/g, '')
        return cell.trim()
      }).filter(c => c.length > 0)
      
      for (const cell of cells) {
        // If cell has a dot, count sentences normally
        if (cell.includes('.')) {
          const sentences = cell.split(/\.\s+/).filter(s => s.trim().length > 0)
          sentenceCount += sentences.length
        } else {
          // No dot, count as one sentence
          sentenceCount += 1
        }
      }
    }
  }
  
  // Remove list/table content from main text for normal sentence counting
  let mainText = content
  const allMatches = [...listMatches, ...tableMatches].sort((a, b) => b.start - a.start)
  for (const match of allMatches) {
    mainText = mainText.slice(0, match.start) + ' ' + mainText.slice(match.end)
  }
  
  // Remove LaTeX commands and comments from remaining text
  mainText = mainText
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})*/g, ' ')
    .replace(/%.*$/gm, '')
    .replace(/\{[^}]*\}/g, ' ')
  
  // Count sentences in remaining text (split by dots)
  const sentences = mainText
    .split(/\.\s+/)
    .filter(s => {
      const trimmed = s.trim()
      // Filter out empty strings and very short fragments
      return trimmed.length > 3
    })
  
  sentenceCount += sentences.length
  
  return sentenceCount
}

/**
 * Parse LaTeX document structure (chapters, sections, etc.)
 */
function parseDocumentStructure(content: string): Array<{
  level: number
  type: string
  title: string
  lineNumber: number
  citations: string[]
  uniqueCitationCommands: number
}> {
  const structure: Array<{
    level: number
    type: string
    title: string
    lineNumber: number
    citations: string[]
    uniqueCitationCommands: number
  }> = []
  
  const lines = content.split('\n')
  const structurePattern = /\\(part|chapter|section|subsection|subsubsection|paragraph|subparagraph)\*?(?:\[[^\]]*\])?\{([^}]+)\}/
  
  const levelMap: Record<string, number> = {
    part: 0,
    chapter: 1,
    section: 2,
    subsection: 3,
    subsubsection: 4,
    paragraph: 5,
    subparagraph: 6,
  }
  
  // Find all structure elements
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(structurePattern)
    if (match) {
      structure.push({
        level: levelMap[match[1]] || 0,
        type: match[1],
        title: match[2],
        lineNumber: i + 1,
        citations: [],
        uniqueCitationCommands: 0,
      })
    }
  }
  
  // Find citations for each section
  // Citations belong to the section they appear in (between current section and next section of same or higher level)
  // We need to be careful not to double-count citations that appear in subsection content
  for (let i = 0; i < structure.length; i++) {
    const currentSection = structure[i]
    
    // Find the next section at the same level or higher (parent level)
    let nextSectionLine = lines.length
    for (let j = i + 1; j < structure.length; j++) {
      if (structure[j].level <= currentSection.level) {
        nextSectionLine = structure[j].lineNumber
        break
      }
    }
    
    // Extract content between this section and next section of same/higher level
    // But exclude content that belongs to subsections (we'll count those separately)
    const sectionStartLine = currentSection.lineNumber
    const sectionEndLine = nextSectionLine
    
    // Find the first subsection (if any) to know where direct section content ends
    let firstSubsectionLine = sectionEndLine
    for (let j = i + 1; j < structure.length; j++) {
      if (structure[j].level > currentSection.level) {
        firstSubsectionLine = structure[j].lineNumber
        break
      }
      if (structure[j].level <= currentSection.level) {
        break
      }
    }
    
    // Only extract content that's directly in this section (before first subsection)
    // Include the section header line itself (sectionStartLine - 1) up to but not including first subsection
    const directSectionContent = lines.slice(sectionStartLine - 1, firstSubsectionLine - 1).join('\n')
    const { citations, uniqueCitationCommands } = parseLatexCitations(directSectionContent)
    currentSection.citations = citations
    currentSection.uniqueCitationCommands = uniqueCitationCommands
  }
  
  // Accumulate citations from child sections into parent sections
  // Process from deepest to shallowest level
  // We recalculate from full content to avoid double-counting
  for (let level = 6; level >= 0; level--) {
    for (let i = structure.length - 1; i >= 0; i--) {
      const currentSection = structure[i]
      if (currentSection.level !== level) continue
      
      // Find the boundaries of this section (including all children)
      const sectionStartLine = currentSection.lineNumber
      let sectionEndLine = lines.length
      for (let j = i + 1; j < structure.length; j++) {
        if (structure[j].level <= currentSection.level) {
          sectionEndLine = structure[j].lineNumber
          break
        }
      }
      
      // Extract full section content (including all children)
      // Include from the section header line up to but not including the next section at same/higher level
      const fullSectionContent = lines.slice(sectionStartLine - 1, sectionEndLine - 1).join('\n')
      
      // Recalculate both citations and unique citation commands from the full content
      // This ensures we count each citation exactly once per section
      const { citations: recalculatedCitations, uniqueCitationCommands: recalculatedUnique } = parseLatexCitations(fullSectionContent)
      
      // Store the cumulative citations
      // uniqueCitationCommands should never exceed the total number of citations
      currentSection.citations = recalculatedCitations
      currentSection.uniqueCitationCommands = Math.min(recalculatedUnique, recalculatedCitations.length)
    }
  }
  
  return structure
}

/**
 * Get citations from GitHub repository files
 */
export async function getCitationsFromGithub(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  
  // Verify project ownership
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  
  if (!project || project.ownerId !== session.user.id) {
    throw new Error("Project not found or unauthorized")
  }
  
  // Get all sources for this project with tags in one batched query.
  const sourceRows = await db
    .select({
      sourceId: sources.id,
      sourceProjectId: sources.projectId,
      sourceAbbreviation: sources.abbreviation,
      sourceTitle: sources.title,
      sourceDescription: sources.description,
      sourceAuthors: sources.authors,
      sourcePublicationDate: sources.publicationDate,
      sourceNotes: sources.notes,
      sourceLinks: sources.links,
      sourceBibtex: sources.bibtex,
      tagId: tags.id,
      tagAbbreviation: tags.abbreviation,
      tagName: tags.name,
      tagColor: tags.color,
    })
    .from(sources)
    .leftJoin(sourceTags, eq(sourceTags.sourceId, sources.id))
    .leftJoin(tags, eq(tags.id, sourceTags.tagId))
    .where(eq(sources.projectId, projectId))
    .orderBy(asc(sources.abbreviation), asc(tags.name))

  const projectSourceMap = new Map<string, {
    id: string
    projectId: string
    abbreviation: string | null
    title: string
    description: string | null
    authors: string | null
    publicationDate: string | null
    notes: string | null
    links: string | null
    bibtex: string | null
    tags: Array<{
      id: string
      abbreviation: string | null
      name: string
      color: string
    }>
  }>()

  for (const row of sourceRows) {
    if (!projectSourceMap.has(row.sourceId)) {
      projectSourceMap.set(row.sourceId, {
        id: row.sourceId,
        projectId: row.sourceProjectId,
        abbreviation: row.sourceAbbreviation,
        title: row.sourceTitle,
        description: row.sourceDescription,
        authors: row.sourceAuthors,
        publicationDate: row.sourcePublicationDate,
        notes: row.sourceNotes,
        links: row.sourceLinks,
        bibtex: row.sourceBibtex,
        tags: [],
      })
    }

    if (row.tagId) {
      projectSourceMap.get(row.sourceId)!.tags.push({
        id: row.tagId,
        abbreviation: row.tagAbbreviation,
        name: row.tagName!,
        color: row.tagColor!,
      })
    }
  }

  const projectSources = Array.from(projectSourceMap.values())

  if (!project.githubRepoUrl || !project.githubRepoFiles) {
    return {
      citations: [],
      totalCitations: 0,
      totalUniqueCitations: 0,
      uniqueSources: 0,
      sourceUsage: {},
      topicUsage: {},
      sources: projectSources,
      averageCitationsPerSentence: 0,
      averageUniqueCitationsPerSentence: 0,
      totalSentences: 0,
      documentStructure: [],
    }
  }
  
  const selectedFiles: string[] = JSON.parse(project.githubRepoFiles)
  const parsedRepo = parseGithubUrl(project.githubRepoUrl)
  if (!parsedRepo) {
    throw new Error("Invalid GitHub repository URL")
  }

  let accessToken: string | null = null
  if (project.githubAccountId) {
    const [githubAccount] = await db
      .select()
      .from(githubAccounts)
      .where(eq(githubAccounts.id, project.githubAccountId))
      .limit(1)

    if (githubAccount) {
      try {
        const appId = process.env.GITHUB_APP_ID
        const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
        if (appId && privateKey) {
          accessToken = await getInstallationToken(appId, privateKey, githubAccount.installationId)
        }
      } catch (error) {
        console.error("Failed to get installation token:", error)
      }
    }
  }

  const defaultBranch = await fetchDefaultBranch(parsedRepo.owner, parsedRepo.repo, accessToken)
  const allCitations: string[] = []
  let totalUniqueCitationCommands = 0
  let totalSentences = 0
  const documentStructure: Array<{
    level: number
    type: string
    title: string
    lineNumber: number
    citations: string[]
    uniqueCitationCommands: number
    filePath: string
  }> = []
  
  const texFiles = selectedFiles.filter((filePath) => filePath.endsWith(".tex"))
  const fileResults = await mapWithConcurrency(texFiles, 4, async (filePath) => {
    try {
      const content = await fetchFileContent(parsedRepo.owner, parsedRepo.repo, filePath, defaultBranch, accessToken)
      const { citations, uniqueCitationCommands } = parseLatexCitations(content)
      const sentences = countSentences(content)
      const structure = parseDocumentStructure(content)

      const topLevelSections = structure.filter((s) => {
        const minLevel = Math.min(...structure.map((sec) => sec.level))
        return s.level === minLevel
      })
      const topLevelTotalCitations = topLevelSections.reduce((sum, sec) => sum + sec.citations.length, 0)
      const fileTotalCitations = citations.length
      if (Math.abs(topLevelTotalCitations - fileTotalCitations) > 5) {
        console.warn(`Citation count mismatch in ${filePath}: file has ${fileTotalCitations} citations, top-level sections sum to ${topLevelTotalCitations}`)
      }

      return { filePath, citations, uniqueCitationCommands, sentences, structure }
    } catch (error) {
      console.error(`Failed to fetch file ${filePath}:`, error)
      return null
    }
  })

  for (const result of fileResults) {
    if (!result) continue
    allCitations.push(...result.citations)
    totalUniqueCitationCommands += result.uniqueCitationCommands
    totalSentences += result.sentences
    for (const section of result.structure) {
      documentStructure.push({
        ...section,
        filePath: result.filePath,
      })
    }
  }
  
  // Calculate average citations per sentence
  const averageCitationsPerSentence = totalSentences > 0 
    ? allCitations.length / totalSentences 
    : 0
  const averageUniqueCitationsPerSentence = totalSentences > 0
    ? totalUniqueCitationCommands / totalSentences
    : 0
  
  // Create a map of abbreviation to source
  const abbreviationMap = new Map<string, typeof projectSources[0]>()
  for (const source of projectSources) {
    if (source.abbreviation) {
      abbreviationMap.set(source.abbreviation.toLowerCase(), source)
    }
  }
  
  // Count citations per source
  const sourceUsage: Record<string, number> = {}
  const matchedSources = new Set<string>()
  
  for (const citation of allCitations) {
    const normalizedCitation = citation.toLowerCase()
    const source = abbreviationMap.get(normalizedCitation)
    
    if (source) {
      const sourceId = source.id
      sourceUsage[sourceId] = (sourceUsage[sourceId] || 0) + 1
      matchedSources.add(sourceId)
    }
  }
  
  // Get tags for sources to calculate topic usage
  const sourceIds = Array.from(matchedSources)
  const topicUsage: Record<string, number> = {}
  
  if (sourceIds.length > 0) {
    const sourceTagRelations = await db
      .select({
        sourceId: sourceTags.sourceId,
        tagId: sourceTags.tagId,
      })
      .from(sourceTags)
      .where(inArray(sourceTags.sourceId, sourceIds))
    
    const tagIds = Array.from(new Set(sourceTagRelations.map((st) => st.tagId)))
    
    if (tagIds.length > 0) {
      const tagData = await db
        .select()
        .from(tags)
        .where(inArray(tags.id, tagIds))
      
      // Count citations per tag
      for (const relation of sourceTagRelations) {
        const sourceCitationCount = sourceUsage[relation.sourceId] || 0
        const tag = tagData.find((t) => t.id === relation.tagId)
        
        if (tag) {
          topicUsage[tag.name] = (topicUsage[tag.name] || 0) + sourceCitationCount
        }
      }
    }
  }
  
  return {
    citations: allCitations,
    totalCitations: allCitations.length,
    totalUniqueCitations: totalUniqueCitationCommands,
    uniqueSources: matchedSources.size,
    sourceUsage,
    topicUsage,
    sources: projectSources,
    averageCitationsPerSentence,
    averageUniqueCitationsPerSentence,
    totalSentences,
    documentStructure,
  }
}

