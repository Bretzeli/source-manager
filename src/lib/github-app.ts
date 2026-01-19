import jwt from "jsonwebtoken"

/**
 * Create a JWT token for GitHub App authentication
 */
export async function createGitHubAppJWT(appId: string, privateKey: string): Promise<string> {
  // Private key might need formatting (remove \n if present)
  const formattedKey = privateKey.replace(/\\n/g, "\n")

  // JWT expires in 10 minutes (GitHub requires < 10 minutes)
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now - 60, // Issued at time (1 minute ago to account for clock skew)
    exp: now + 600, // Expires in 10 minutes
    iss: appId, // Issuer (GitHub App ID)
  }

  return jwt.sign(payload, formattedKey, { algorithm: "RS256" })
}

/**
 * Get installation access token for a GitHub App installation
 */
export async function getInstallationToken(
  appId: string,
  privateKey: string,
  installationId: string
): Promise<string> {
  const jwtToken = await createGitHubAppJWT(appId, privateKey)

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${jwtToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get installation token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.token
}

/**
 * Get installation information (including account details)
 */
export async function getInstallation(
  appId: string,
  privateKey: string,
  installationId: string
): Promise<{ account: { login: string; type: string } }> {
  const jwtToken = await createGitHubAppJWT(appId, privateKey)

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${jwtToken}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get installation: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get list of repositories accessible by an installation
 */
export async function getInstallationRepositories(
  appId: string,
  privateKey: string,
  installationId: string
): Promise<Array<{ id: number; full_name: string; name: string; private: boolean; html_url: string }>> {
  const token = await getInstallationToken(appId, privateKey, installationId)

  const response = await fetch(
    `https://api.github.com/installation/repositories`,
    {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${token}`,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get repositories: ${response.statusText}`)
  }

  const data = await response.json()
  return data.repositories || []
}

