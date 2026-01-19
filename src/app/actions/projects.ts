"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { projects, githubAccounts } from "@/lib/db/app-schema"
import { account } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { getInstallationToken, getInstallationRepositories } from "@/lib/github-app"

export async function getProjects() {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return []
  }

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, session.user.id))
    .orderBy(desc(projects.lastEditedAt))

  return userProjects
}

export async function getProject(projectId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return null
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id) {
    return null
  }

  return project
}

export async function createProject(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const title = formData.get("title") as string
  const description = formData.get("description") as string | null

  if (!title || title.trim().length === 0) {
    throw new Error("Title is required")
  }

  const [newProject] = await db
    .insert(projects)
    .values({
      ownerId: session.user.id,
      title: title.trim(),
      description: description?.trim() || null,
    })
    .returning()

  revalidatePath("/")
  return newProject
}

export async function deleteProject(projectId: string) {
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

  await db
    .delete(projects)
    .where(eq(projects.id, projectId))

  revalidatePath("/")
}

/**
 * Parse GitHub repository URL to owner/repo format
 */
function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Handle various GitHub URL formats:
    // https://github.com/owner/repo
    // https://github.com/owner/repo.git
    // git@github.com:owner/repo.git
    // owner/repo
    
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

/**
 * Fetch files from a GitHub repository
 * @param repoUrl - GitHub repository URL
 * @param projectId - Optional project ID to use stored access token for private repos
 */
export async function fetchGithubRepoFiles(repoUrl: string, projectId?: string) {
  const parsed = parseGithubUrl(repoUrl)
  
  if (!parsed) {
    throw new Error("Invalid GitHub repository URL")
  }
  
  const { owner, repo } = parsed
  const repoFullName = `${owner}/${repo}`
  
  // Get installation access token if projectId is provided and has GitHub App installed
  let accessToken: string | null = null
  if (projectId) {
    const session = await auth.api.getSession({ headers: await headers() })
    if (session?.user) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)
      
      if (project && project.ownerId === session.user.id && project.githubAccountId) {
        // Get the GitHub account linked to this project
        const [githubAccount] = await db
          .select()
          .from(githubAccounts)
          .where(eq(githubAccounts.id, project.githubAccountId))
          .limit(1)
        
        if (githubAccount) {
          try {
            // Verify the repository is in the selected repos list
            const selectedRepos = githubAccount.selectedRepos 
              ? JSON.parse(githubAccount.selectedRepos) 
              : []
            
            if (!selectedRepos.includes(repoFullName)) {
              throw new Error(`Repository ${repoFullName} is not in the list of repositories you granted access to for ${githubAccount.githubUsername}. Please reinstall the GitHub App and select this repository.`)
            }
            
            // Get GitHub App credentials
            const appId = process.env.GITHUB_APP_ID
            const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
            
            if (!appId || !privateKey) {
              throw new Error("GitHub App is not configured")
            }
            
            // Get fresh installation token
            accessToken = await getInstallationToken(appId, privateKey, githubAccount.installationId)
          } catch (error) {
            console.error("Failed to get installation token:", error)
            if (error instanceof Error && error.message.includes("not in the list")) {
              throw error
            }
            // Continue without token (will work for public repos)
          }
        }
      }
    }
  }
  
  // Helper function to make authenticated requests
  const makeRequest = async (url: string) => {
    const headers: HeadersInit = {
      Accept: "application/vnd.github.v3+json",
    }
    
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }
    
    return fetch(url, { headers })
  }
  
  try {
    // Use GitHub API to fetch repository contents
    // For now, we'll fetch from the default branch (usually main/master)
    // Works for public repos without authentication, private repos with token
    const response = await makeRequest(
      `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`
    )
    
    // Try master if main fails
    if (!response.ok) {
      const masterResponse = await makeRequest(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`
      )
      
      if (!masterResponse.ok) {
        // If both fail, try to get default branch
        const repoResponse = await makeRequest(
          `https://api.github.com/repos/${owner}/${repo}`
        )
        
        if (!repoResponse.ok) {
          if (repoResponse.status === 404) {
            throw new Error("Repository not found or is private. Please connect your GitHub account to access private repositories.")
          }
          throw new Error(`GitHub API error: ${repoResponse.statusText}`)
        }
        
        const repoData = await repoResponse.json()
        const defaultBranch = repoData.default_branch
        
        const branchResponse = await makeRequest(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`
        )
        
        if (!branchResponse.ok) {
          throw new Error("Failed to fetch repository contents")
        }
        
        const data = await branchResponse.json()
        return data.tree
          .filter((item: { type: string; path: string }) => 
            item.type === "blob" && 
            (item.path.endsWith(".tex") || item.path.endsWith(".bib") || item.path.endsWith(".md"))
          )
          .map((item: { path: string }) => item.path)
      }
      
      const data = await masterResponse.json()
      return data.tree
        .filter((item: { type: string; path: string }) => 
          item.type === "blob" && 
          (item.path.endsWith(".tex") || item.path.endsWith(".bib") || item.path.endsWith(".md"))
        )
        .map((item: { path: string }) => item.path)
    }
    
    const data = await response.json()
    return data.tree
      .filter((item: { type: string; path: string }) => 
        item.type === "blob" && 
        (item.path.endsWith(".tex") || item.path.endsWith(".bib") || item.path.endsWith(".md"))
      )
      .map((item: { path: string }) => item.path)
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    throw new Error("Failed to fetch repository files")
  }
}

/**
 * Update project GitHub repository URL and selected files
 */
export async function updateProjectGithubRepo(
  projectId: string,
  repoUrl: string | null,
  selectedFiles: string[] = []
) {
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
  
  // Validate GitHub URL if provided
  if (repoUrl && repoUrl.trim()) {
    const parsed = parseGithubUrl(repoUrl.trim())
    if (!parsed) {
      throw new Error("Invalid GitHub repository URL")
    }
  }
  
  // Update project
  const [updatedProject] = await db
    .update(projects)
    .set({
      githubRepoUrl: repoUrl?.trim() || null,
      githubRepoFiles: selectedFiles.length > 0 ? JSON.stringify(selectedFiles) : null,
    })
    .where(eq(projects.id, projectId))
    .returning()
  
  revalidatePath(`/projects/${projectId}/settings`)
  return updatedProject
}

/**
 * Unlink GitHub repository from project
 */
export async function unlinkProjectGithubRepo(projectId: string) {
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
  
  // Remove GitHub repo link (but keep GitHub account link)
  const [updatedProject] = await db
    .update(projects)
    .set({
      githubRepoUrl: null,
      githubRepoFiles: null,
    })
    .where(eq(projects.id, projectId))
    .returning()
  
  revalidatePath(`/projects/${projectId}/settings`)
  return updatedProject
}

/**
 * Disconnect GitHub App from project (removes account link but keeps repo URL)
 */
export async function disconnectGithubAccount(projectId: string) {
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
  
  // Remove only the GitHub account link (keep repo URL and files)
  const [updatedProject] = await db
    .update(projects)
    .set({
      githubAccountId: null,
    })
    .where(eq(projects.id, projectId))
    .returning()
  
  revalidatePath(`/projects/${projectId}/settings`)
  return updatedProject
}

/**
 * Check if GitHub account is linked for a project
 */
export async function hasGithubConnection(projectId: string): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return false
  }
  
  const [project] = await db
    .select({ 
      ownerId: projects.ownerId,
      githubAccountId: projects.githubAccountId 
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)
  
  return !!(project && project.ownerId === session.user.id && project.githubAccountId)
}

/**
 * Get all GitHub accounts linked to the current user
 */
export async function getUserGithubAccounts() {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  
  const accounts = await db
    .select()
    .from(githubAccounts)
    .where(eq(githubAccounts.userId, session.user.id))
    .orderBy(desc(githubAccounts.isPrimary), desc(githubAccounts.createdAt))
  
  return accounts.map((acc) => ({
    id: acc.id,
    githubUsername: acc.githubUsername,
    installationId: acc.installationId,
    selectedRepos: acc.selectedRepos ? JSON.parse(acc.selectedRepos) : [],
    isPrimary: acc.isPrimary,
    createdAt: acc.createdAt,
  }))
}

/**
 * Check if user logged in with GitHub and get their GitHub account info
 */
export async function getLoggedInGithubAccount() {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return null
  }
  
  // Check if user has a GitHub account in better-auth
  const [githubAccount] = await db
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, session.user.id),
        eq(account.providerId, "github")
      )
    )
    .limit(1)
  
  if (!githubAccount) {
    return null
  }
  
  // Check if this GitHub account is already linked as a github_accounts entry
  const [linkedAccount] = await db
    .select()
    .from(githubAccounts)
    .where(eq(githubAccounts.accountId, githubAccount.id))
    .limit(1)
  
  return {
    accountId: githubAccount.id,
    githubAccountId: githubAccount.accountId, // The GitHub user ID
    isLinked: !!linkedAccount,
    linkedAccountId: linkedAccount?.id || null,
  }
}

/**
 * Fetch accessible repositories from GitHub App installation for a project
 */
export async function getGithubRepositories(projectId: string) {
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
  
  if (!project.githubAccountId) {
    throw new Error("GitHub account not linked to this project")
  }
  
  // Get the GitHub account linked to this project
  const [githubAccount] = await db
    .select()
    .from(githubAccounts)
    .where(eq(githubAccounts.id, project.githubAccountId))
    .limit(1)
  
  if (!githubAccount) {
    throw new Error("GitHub account not found")
  }
  
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY
  
  if (!appId || !privateKey) {
    throw new Error("GitHub App is not configured")
  }
  
  try {
    // Get repositories from installation (only the ones user selected)
    const repositories = await getInstallationRepositories(
      appId,
      privateKey,
      githubAccount.installationId
    )
    
    return repositories.map((repo) => ({
      fullName: repo.full_name,
      name: repo.name,
      private: repo.private,
      url: repo.html_url,
    }))
  } catch (error) {
    console.error("Failed to fetch GitHub repositories:", error)
    throw new Error("Failed to fetch repositories")
  }
}

/**
 * Sync existing GitHub App installation - checks if user has installed the app but it's not in our DB
 * This handles the case where user installed directly on GitHub without going through our callback
 */
export async function syncExistingGithubInstallation(projectId: string, installationId: string) {
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

  // Check if this installation already exists in our DB
  const [existingAccount] = await db
    .select()
    .from(githubAccounts)
    .where(eq(githubAccounts.installationId, installationId))
    .limit(1)

  if (existingAccount) {
    // Just link it to the project if not already linked
    if (!project.githubAccountId || project.githubAccountId !== existingAccount.id) {
      await db
        .update(projects)
        .set({ githubAccountId: existingAccount.id })
        .where(eq(projects.id, projectId))
      revalidatePath(`/projects/${projectId}/settings`)
    }
    return { success: true, accountId: existingAccount.id }
  }

  // Get GitHub App credentials
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

  if (!appId || !privateKey) {
    throw new Error("GitHub App is not configured")
  }

  try {
    // Get installation info and repositories (this is what the callback would do)
    const { getInstallation, getInstallationRepositories } = await import("@/lib/github-app")
    
    const installationInfo = await getInstallation(appId, privateKey, installationId)
    const githubUsername = installationInfo.account.login

    const repositories = await getInstallationRepositories(appId, privateKey, installationId)

    if (!repositories || repositories.length === 0) {
      throw new Error("No repositories found in this installation")
    }

    // Check if user logged in with GitHub
    const [githubAccount] = await db
      .select()
      .from(account)
      .where(
        and(
          eq(account.userId, session.user.id),
          eq(account.providerId, "github")
        )
      )
      .limit(1)

    // Create github_accounts entry
    const [created] = await db
      .insert(githubAccounts)
      .values({
        userId: session.user.id,
        accountId: githubAccount?.id || null,
        githubUsername,
        installationId,
        selectedRepos: JSON.stringify(repositories.map((repo) => repo.full_name)),
        isPrimary: !!githubAccount,
      })
      .returning()

    // Link to project
    await db
      .update(projects)
      .set({ githubAccountId: created.id })
      .where(eq(projects.id, projectId))

    revalidatePath(`/projects/${projectId}/settings`)
    return { success: true, accountId: created.id, reposCount: repositories.length }
  } catch (error) {
    console.error("Failed to sync installation:", error)
    throw error instanceof Error ? error : new Error("Failed to sync installation")
  }
}

/**
 * Get the GitHub App installation ID for a project
 */
export async function getProjectInstallationId(projectId: string): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const [project] = await db
    .select({
      ownerId: projects.ownerId,
      githubAccountId: projects.githubAccountId,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project || project.ownerId !== session.user.id || !project.githubAccountId) {
    return null
  }

  const [githubAccount] = await db
    .select({ installationId: githubAccounts.installationId })
    .from(githubAccounts)
    .where(eq(githubAccounts.id, project.githubAccountId))
    .limit(1)

  return githubAccount?.installationId || null
}

/**
 * Update project's GitHub account link
 */
export async function updateProjectGithubAccount(projectId: string, githubAccountId: string | null) {
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
  
  // If githubAccountId is provided, verify it belongs to the user
  if (githubAccountId) {
    const [githubAccount] = await db
      .select()
      .from(githubAccounts)
      .where(
        and(
          eq(githubAccounts.id, githubAccountId),
          eq(githubAccounts.userId, session.user.id)
        )
      )
      .limit(1)
    
    if (!githubAccount) {
      throw new Error("GitHub account not found or unauthorized")
    }
  }
  
  const [updatedProject] = await db
    .update(projects)
    .set({
      githubAccountId,
    })
    .where(eq(projects.id, projectId))
    .returning()
  
  revalidatePath(`/projects/${projectId}/settings`)
  return updatedProject
}

