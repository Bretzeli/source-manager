# GitHub App Setup for Repository Access

This app uses **GitHub Apps** instead of OAuth Apps, which allows users to **select specific repositories** during installation rather than granting access to ALL repositories.

## Why GitHub Apps?

- ✅ **Repository Selection**: Users can choose exactly which repositories to grant access to
- ✅ **Granular Permissions**: Request only "Contents: Read-only" instead of full `repo` scope
- ✅ **Better Security**: Access limited to selected repositories only
- ✅ **Short-lived Tokens**: Tokens are generated fresh when needed

## Configuration Steps

### 1. Create a GitHub App

1. Go to GitHub → Settings → Developer settings → GitHub Apps → New GitHub App
2. Fill in the application details:
   - **Application name**: Your App Name (e.g., "Source Manager")
   - **Homepage URL**: 
     - Development: `http://localhost:3000`
     - Production: `https://yourdomain.com`
   - **Callback URL** (User authorization callback URL): 
     - Development: `http://localhost:3000/api/github-connect/callback`
     - Production: `https://yourdomain.com/api/github-connect/callback`
   - **Setup URL (Post installation)**: **REQUIRED** - This is where users are redirected after installing the app
     - Development: `http://localhost:3000/api/github-connect/callback`
     - Production: `https://yourdomain.com/api/github-connect/callback`
     - ⚠️ **IMPORTANT**: This MUST match your callback URL or users will be redirected to the GitHub installation settings page instead of back to your app!
   - **Webhook Active**: Leave unchecked (not needed)
   - **Webhook URL**: Leave empty (not needed)
   - **Webhook secret**: Leave empty (not needed)
   
3. **Checkboxes** (all should be **unchecked**):
   - ❌ Expire user authorization tokens (not needed for GitHub Apps)
   - ❌ Request user authorization (OAuth) during installation (not needed)
   - ❌ Enable Device Flow (not needed)
   - ❌ Redirect on update (not needed)

3. **Set Permissions**:
   - **Repository permissions**:
     - **Contents**: Read-only (to read repository files)
     - **Metadata**: Read-only (automatically set)
   
   **Important**: Only request the minimum permissions you need!

4. **Where can this GitHub App be installed?**:
   - Select "Any account" (or restrict as needed)

5. Click "Create GitHub App"

### 2. Get Your App Credentials

After creating the GitHub App:

1. Copy the **App ID** (visible on the app page)
2. Generate a **Private key**:
   - Click "Generate a private key"
   - Download and save the `.pem` file
   - Copy the entire contents (including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----`)

3. Find your **App slug**:
   - It's in the URL: `https://github.com/apps/your-app-slug`
   - Or visible on the app settings page

### 3. Set Environment Variables

Add these to your `.env` file:

```env
GITHUB_APP_ID=123456
GITHUB_APP_SLUG=your-app-slug
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
(entire private key content here)
...
-----END RSA PRIVATE KEY-----"
BETTER_AUTH_URL=http://localhost:3000  # or https://yourdomain.com for production
```

**Important**: 
- The private key must include the full key with headers
- Use quotes and keep newlines as `\n` or paste the actual newlines
- Do NOT commit this file to version control!

### 4. Install Required Package

```bash
npm install jsonwebtoken @types/jsonwebtoken
```

### 5. Update Database Schema

Run the migration to add the new fields:
```bash
npm run db:push
# or
npm run db:migrate
```

## How It Works

1. **User clicks "Install GitHub App"**: They're redirected to GitHub's installation page
2. **User selects repositories**: GitHub shows a screen where users can choose:
   - "All repositories" (grants access to all)
   - **"Only select repositories"** (allows picking specific repos) ⭐ This is the key feature!
3. **Installation callback**: After installation, GitHub redirects back with an installation ID
4. **Store installation**: The app stores the installation ID and list of accessible repositories
5. **Generate tokens**: When accessing a repository, the app generates a short-lived installation token
6. **Access repositories**: Only repositories selected during installation are accessible

## User Experience

1. User enters a repository URL manually (works for public repos)
2. OR user clicks "Install GitHub App" and selects specific repositories
3. After installation, selected repositories appear in a dropdown
4. User can select from dropdown or enter URL manually
5. When accessing a repo, the app verifies it's in the selected list
6. If not selected, user gets an error asking them to reinstall and select the repo

## Key Differences from OAuth Apps

| Feature | OAuth App | GitHub App |
|---------|-----------|------------|
| Repository selection | ❌ No - access to ALL repos | ✅ Yes - users select specific repos |
| Granular permissions | ❌ No - `repo` scope is all or nothing | ✅ Yes - fine-grained permissions |
| Token lifetime | Long-lived (until revoked) | Short-lived (1 hour, auto-refreshed) |
| Security | Lower - broader access | Higher - limited to selected repos |

## Troubleshooting

### Error: "GitHub App is not configured"

- Make sure all environment variables are set: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_SLUG`
- Verify the private key is correctly formatted

### Error: "Repository not in the list"

- The repository you're trying to access wasn't selected during installation
- Reinstall the GitHub App and select the repository you need
- Only repositories selected during installation are accessible

### Error: "Failed to get installation token"

- Check that the private key is correct
- Verify the App ID matches your GitHub App
- Ensure the installation ID is valid

### Installation callback not working

- Verify the callback URL in GitHub App settings matches exactly: `/api/github-connect/callback`
- Check that `BETTER_AUTH_URL` is set correctly in your environment

## Migration from OAuth App

If you were previously using OAuth Apps:
1. Create a new GitHub App (as described above)
2. Update environment variables
3. Users will need to install the new GitHub App
4. Old OAuth tokens will no longer be used

