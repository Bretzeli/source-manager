import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { db } from "@/lib/db"
import { projects, githubAccounts } from "@/lib/db/app-schema"
import { account } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { getInstallationRepositories, getInstallation } from "@/lib/github-app"

/**
 * GitHub App installation callback handler
 * After user installs the GitHub App and selects repositories, GitHub redirects here
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    
    if (!session?.user) {
      return NextResponse.redirect(new URL("/?error=unauthorized", request.url))
    }

    const searchParams = request.nextUrl.searchParams
    const installationId = searchParams.get("installation_id")
    const setupAction = searchParams.get("setup_action")
    const state = searchParams.get("state")

    if (!installationId) {
      return NextResponse.redirect(new URL("/?error=no_installation_id", request.url))
    }

    // Try to get projectId from cookie, or from URL params, or from state
    let projectId = request.cookies.get("github_app_project_id")?.value
    let redirectUrl = request.cookies.get("github_app_redirect_url")?.value
    
    // If no cookies, try to extract from state or URL params
    if (!projectId) {
      if (state) {
        const stateParts = state.split(":")
        projectId = stateParts[0]
      }
    }
    
    // If still no redirectUrl, try to construct from request
    if (!redirectUrl) {
      const baseUrl = process.env.BETTER_AUTH_URL || 
        process.env.NEXT_PUBLIC_APP_URL || 
        `${request.nextUrl.protocol}//${request.nextUrl.host}`
      // Try to get from referer or use default
      redirectUrl = `${baseUrl}/projects/${projectId || ""}/settings`
    }

    // If we have installation_id but no projectId, we can still sync it
    // Just redirect back to settings page with the installation_id so the component can handle it
    if (!projectId) {
      const baseUrl = process.env.BETTER_AUTH_URL || 
        process.env.NEXT_PUBLIC_APP_URL || 
        `${request.nextUrl.protocol}//${request.nextUrl.host}`
      // Redirect to a page where user can select which project to link
      // For now, redirect to home and let them navigate - or we could show a selection page
      return NextResponse.redirect(
        new URL(`${baseUrl}/?installation_id=${installationId}&setup_action=${setupAction || "install"}`, request.url)
      )
    }

    // Verify project ownership
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1)

    if (!project || project.ownerId !== session.user.id) {
      return NextResponse.redirect(
        new URL(`${redirectUrl}?error=unauthorized`, request.url)
      )
    }

    // Get GitHub App credentials
    const githubAppId = process.env.GITHUB_APP_ID
    const githubAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY

    if (!githubAppId || !githubAppPrivateKey) {
      return NextResponse.redirect(
        new URL(`${redirectUrl}?error=config_error`, request.url)
      )
    }

    // Get installation info to get GitHub account username
    const installationInfo = await getInstallation(
      githubAppId,
      githubAppPrivateKey,
      installationId
    )

    const githubUsername = installationInfo.account.login

    // Get list of accessible repositories for this installation
    // These are the repositories the user selected during installation
    const repositories = await getInstallationRepositories(
      githubAppId,
      githubAppPrivateKey,
      installationId
    )

    if (!repositories || repositories.length === 0) {
      return NextResponse.redirect(
        new URL(`${redirectUrl}?error=no_repositories`, request.url)
      )
    }

    // Check if user logged in with GitHub (find their GitHub account in better-auth)
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

    // Check if github_accounts entry already exists for this installation
    const [existingGithubAccount] = await db
      .select()
      .from(githubAccounts)
      .where(eq(githubAccounts.installationId, installationId))
      .limit(1)

    let githubAccountRecord
    if (existingGithubAccount) {
      // Update existing entry
      const [updated] = await db
        .update(githubAccounts)
        .set({
          githubUsername,
          selectedRepos: JSON.stringify(repositories.map((repo) => repo.full_name)),
          accountId: githubAccount?.id || null,
          isPrimary: !!githubAccount, // Is primary if this is the account they logged in with
          updatedAt: new Date(),
        })
        .where(eq(githubAccounts.id, existingGithubAccount.id))
        .returning()
      githubAccountRecord = updated
    } else {
      // Create new entry
      const [created] = await db
        .insert(githubAccounts)
        .values({
          userId: session.user.id,
          accountId: githubAccount?.id || null,
          githubUsername,
          installationId,
          selectedRepos: JSON.stringify(repositories.map((repo) => repo.full_name)),
          isPrimary: !!githubAccount, // Is primary if this is the account they logged in with
        })
        .returning()
      githubAccountRecord = created
    }

    // Link this GitHub account to the project
    await db
      .update(projects)
      .set({
        githubAccountId: githubAccountRecord.id,
      })
      .where(eq(projects.id, projectId))

    // Clear cookies and redirect
    const response = NextResponse.redirect(
      new URL(`${redirectUrl}?success=installed&repos=${repositories.length}`, request.url)
    )
    response.cookies.delete("github_app_state")
    response.cookies.delete("github_app_project_id")
    response.cookies.delete("github_app_redirect_url")

    return response
  } catch (error) {
    console.error("GitHub App installation callback error:", error)
    const redirectUrl = request.cookies.get("github_app_redirect_url")?.value || "/"
    return NextResponse.redirect(
      new URL(`${redirectUrl}?error=internal_error`, request.url)
    )
  }
}

