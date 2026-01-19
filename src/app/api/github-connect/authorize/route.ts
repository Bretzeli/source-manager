import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import crypto from "crypto"

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const projectId = searchParams.get("projectId")
  const redirectUrl = searchParams.get("redirectUrl")

  if (!projectId || !redirectUrl) {
    return NextResponse.json(
      { error: "projectId and redirectUrl are required" },
      { status: 400 }
    )
  }

  const githubAppSlug = process.env.GITHUB_APP_SLUG
  if (!githubAppSlug) {
    return NextResponse.json(
      { error: "GitHub App is not configured. Please set GITHUB_APP_SLUG in your environment variables." },
      { status: 500 }
    )
  }

  // Get base URL from environment or construct from request
  const baseUrl = process.env.BETTER_AUTH_URL || 
    process.env.NEXT_PUBLIC_APP_URL || 
    `${request.nextUrl.protocol}//${request.nextUrl.host}`
  
  // Redirect to GitHub App installation page where users can select specific repositories
  // This allows users to choose which repositories to grant access to, rather than all repos
  const redirectUri = `${baseUrl}/api/github-connect/callback`

  // Build GitHub App installation URL
  // Users will see a screen where they can select "Only select repositories" 
  // and choose exactly which repos to grant access to
  // Note: GitHub Apps don't use redirect_uri query param - they use the "Setup URL" 
  // configured in GitHub App settings, so make sure that's set correctly!
  const githubInstallUrl = new URL(`https://github.com/apps/${githubAppSlug}/installations/new`)
  githubInstallUrl.searchParams.set("state", `${projectId}:${Date.now()}`)

  const response = NextResponse.redirect(githubInstallUrl.toString())

  // Store projectId and redirectUrl in cookies for callback
  // Note: state is already in the URL, but we store in cookies for security
  const state = `${projectId}:${crypto.randomBytes(32).toString("hex")}:${Date.now()}`
  
  response.cookies.set("github_app_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
  })

  response.cookies.set("github_app_project_id", projectId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
  })

  response.cookies.set("github_app_redirect_url", redirectUrl, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
  })

  return response
}

