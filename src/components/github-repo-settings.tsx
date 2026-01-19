"use client"

import { useState, useTransition, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "@/lib/i18n"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  updateProjectGithubRepo, 
  unlinkProjectGithubRepo,
  disconnectGithubAccount,
  fetchGithubRepoFiles,
  hasGithubConnection,
  getGithubRepositories,
  getUserGithubAccounts,
  getLoggedInGithubAccount,
  updateProjectGithubAccount,
  getProjectInstallationId
} from "@/app/actions/projects"
import { toast } from "sonner"
import { ExternalLink, Github, X, Loader2, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface GithubRepoSettingsProps {
  projectId: string
  currentRepoUrl?: string
  currentSelectedFiles?: string[]
  hasConnection?: boolean
}

interface GithubRepo {
  fullName: string
  name: string
  private: boolean
  url: string
}

interface GithubAccount {
  id: string
  githubUsername: string
  selectedRepos: string[]
  isPrimary: boolean
}

export function GithubRepoSettings({
  projectId,
  currentRepoUrl,
  currentSelectedFiles = [],
  hasConnection: initialHasConnection = false,
}: GithubRepoSettingsProps) {
  const { t } = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [repoUrl, setRepoUrl] = useState(currentRepoUrl || "")
  const [availableFiles, setAvailableFiles] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<string[]>(currentSelectedFiles)
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isSaving, startSaving] = useTransition()
  const [isUnlinking, startUnlinking] = useTransition()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, startDisconnecting] = useTransition()
  const [hasConnection, setHasConnection] = useState(initialHasConnection)
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)
  const [showUnlinkDialog, setShowUnlinkDialog] = useState(false)
  const [githubRepos, setGithubRepos] = useState<GithubRepo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)
  const [githubAccounts, setGithubAccounts] = useState<GithubAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [loggedInGithubAccount, setLoggedInGithubAccount] = useState<{ isLinked: boolean; accountId: string | null } | null>(null)
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true)
  const [installationId, setInstallationId] = useState<string | null>(null)

  // Check GitHub App installation callback result
  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")
    const reposCount = searchParams.get("repos")
    const installationId = searchParams.get("installation_id")
    
    // Check if we have an installation ID in the URL (from callback or direct redirect)
    if (installationId && !hasConnection) {
      // Try to sync the installation
      const syncInstallation = async () => {
        try {
          const { syncExistingGithubInstallation } = await import("@/app/actions/projects")
          await syncExistingGithubInstallation(projectId, installationId)
          toast.success(t.settings.github.toast.accountLinked)
          await loadGithubAccounts()
          router.replace(window.location.pathname, { scroll: false })
        } catch (error) {
          console.error("Failed to sync installation:", error)
        }
      }
      syncInstallation()
      return
    }
    
    if (success === "installed") {
      toast.success(t.settings.github.toast.appInstalled.replace("{count}", reposCount || "0"))
      loadGithubAccounts()
      router.replace(window.location.pathname, { scroll: false })
    } else if (error) {
      const errorMessages: Record<string, string> = {
        unauthorized: t.settings.github.toast.unauthorized,
        invalid_request: t.settings.github.toast.invalidRequest,
        config_error: t.settings.github.toast.configError,
        no_repositories: t.settings.github.toast.noRepositories,
        internal_error: t.settings.github.toast.internalError,
      }
      toast.error(errorMessages[error] || t.settings.github.toast.failedToInstall)
      router.replace(window.location.pathname, { scroll: false })
    }
  }, [searchParams, router, projectId, hasConnection])

  // Load GitHub accounts and check logged-in account
  const loadGithubAccounts = async () => {
    setIsLoadingAccounts(true)
    try {
      const [accounts, loggedInAccount] = await Promise.all([
        getUserGithubAccounts(),
        getLoggedInGithubAccount(),
      ])
      
      setGithubAccounts(accounts)
      setLoggedInGithubAccount(loggedInAccount ? { isLinked: loggedInAccount.isLinked, accountId: loggedInAccount.accountId } : null)
      
      // Check if project has a linked account
      const hasConn = await hasGithubConnection(projectId)
      setHasConnection(hasConn)
      
      if (hasConn) {
        // Get installation ID for updating repos
        try {
          const instId = await getProjectInstallationId(projectId)
          setInstallationId(instId)
        } catch (error) {
          console.error("Failed to get installation ID:", error)
        }
        
        // Get the linked account for this project (we'll fetch this separately)
        loadGithubRepos()
      } else if (loggedInAccount?.isLinked && accounts.length > 0) {
        // Auto-link the logged-in account if available
        const primaryAccount = accounts.find(acc => acc.isPrimary) || accounts[0]
        if (primaryAccount) {
          try {
            await updateProjectGithubAccount(projectId, primaryAccount.id)
            setSelectedAccountId(primaryAccount.id)
            setHasConnection(true)
            loadGithubRepos(primaryAccount.id)
          } catch (error) {
            console.error("Failed to auto-link account:", error)
          }
        }
      }
    } catch (error) {
      console.error("Failed to load GitHub accounts:", error)
    } finally {
      setIsLoadingAccounts(false)
    }
  }

  // Check connection status and accounts on mount
  useEffect(() => {
    loadGithubAccounts()
  }, [projectId])

  // Load GitHub repositories for the selected account
  const loadGithubRepos = async (accountId?: string) => {
    setIsLoadingRepos(true)
    try {
      const repos = await getGithubRepositories(projectId)
      setGithubRepos(repos)
      
      // Auto-select repo if only one is available
      if (repos.length === 1 && !repoUrl) {
        setRepoUrl(repos[0].url)
        // Auto-fetch files for the single repo (silent on auto-select)
        setTimeout(() => handleFetchFiles(repos[0].url, true), 100)
      }
    } catch (error) {
      console.error("Failed to load GitHub repositories:", error)
      setGithubRepos([])
    } finally {
      setIsLoadingRepos(false)
    }
  }

  const handleConnectGithub = async () => {
    setIsConnecting(true)
    
    // First check if there's an installation ID in the URL (user might have been redirected here)
    const urlParams = new URLSearchParams(window.location.search)
    const installationId = urlParams.get("installation_id")
    
    if (installationId) {
      // User was redirected here with an installation ID - sync it
      try {
        const { syncExistingGithubInstallation } = await import("@/app/actions/projects")
        await syncExistingGithubInstallation(projectId, installationId)
        toast.success(t.settings.github.toast.accountLinked)
        await loadGithubAccounts()
        // Clean up URL
        router.replace(window.location.pathname, { scroll: false })
        setIsConnecting(false)
        return
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t.settings.github.toast.failedToSync)
        setIsConnecting(false)
        return
      }
    }
    
    const redirectUrl = window.location.href.split("?")[0]
    // Redirect to GitHub App installation page where users can select repositories
    const authorizeUrl = `/api/github-connect/authorize?projectId=${projectId}&redirectUrl=${encodeURIComponent(redirectUrl)}`
    window.location.href = authorizeUrl
  }

  const handleManualSync = async () => {
    const installationId = prompt("Enter your GitHub App installation ID.\n\nYou can find it in the URL when you visit:\nhttps://github.com/settings/installations/INSTALLATION_ID\n\nFor example: 105082501")
    
    if (!installationId || !installationId.trim()) {
      return
    }

    setIsConnecting(true)
    try {
      const { syncExistingGithubInstallation } = await import("@/app/actions/projects")
      const result = await syncExistingGithubInstallation(projectId, installationId.trim())
      toast.success(`${t.settings.github.toast.accountLinked} ${t.settings.github.accessGranted.replace("{count}", String(result.reposCount || 0))}`)
      await loadGithubAccounts()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.settings.github.toast.failedToSync)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleUpdateRepos = () => {
    // Redirect to GitHub installation update page
    if (installationId) {
      // Redirect to the installation settings page where user can update repos
      window.open(`https://github.com/settings/installations/${installationId}`, "_blank")
      toast.info(t.settings.github.toast.updateReposInfo)
    } else {
      // If no installation ID, go through the normal installation flow
      handleConnectGithub()
    }
  }

  const handleDisconnectGithub = () => {
    setShowDisconnectDialog(true)
  }

  const confirmDisconnectGithub = () => {
    setShowDisconnectDialog(false)
    startDisconnecting(async () => {
      try {
        await disconnectGithubAccount(projectId)
        setHasConnection(false)
        setGithubRepos([])
        setSelectedAccountId(null)
        toast.success(t.settings.github.toast.accountDisconnected)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t.settings.github.toast.failedToDisconnect)
      }
    })
  }

  const handleAccountChange = async (accountId: string) => {
    setSelectedAccountId(accountId)
    try {
      await updateProjectGithubAccount(projectId, accountId)
      setHasConnection(true)
      await loadGithubRepos(accountId)
      toast.success(t.settings.github.toast.accountUpdated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.settings.github.toast.failedToUpdate)
    }
  }

  const handleRepoSelect = (repoUrl: string) => {
    setRepoUrl(repoUrl)
    // Automatically fetch files when a repo is selected
    if (repoUrl) {
      handleFetchFiles(repoUrl)
    }
  }

  const handleFetchFiles = async (url?: string, silent = false) => {
    const urlToFetch = url || repoUrl.trim()
    if (!urlToFetch) {
      toast.error(t.settings.github.toast.pleaseSelectRepo)
      return
    }

    setIsLoadingFiles(true)
    try {
      const files = await fetchGithubRepoFiles(urlToFetch, projectId)
      setAvailableFiles(files)
      // Restore previously selected files if they exist in the fetched files
      if (currentSelectedFiles.length > 0) {
        const validSelectedFiles = currentSelectedFiles.filter(f => files.includes(f))
        setSelectedFiles(validSelectedFiles)
      }
      // Only show toast notification if not silent (user-initiated action)
      if (!silent) {
        toast.success(t.settings.github.toast.filesFound.replace("{count}", String(files.length)))
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t.settings.github.toast.failedToFetchFiles
      toast.error(errorMessage)
      setAvailableFiles([])
    } finally {
      setIsLoadingFiles(false)
    }
  }

  // Auto-fetch files when repo is selected or when component loads with existing repo
  useEffect(() => {
    if (repoUrl && hasConnection && githubRepos.length > 0 && availableFiles.length === 0 && !isLoadingFiles) {
      // Silent fetch on page load (don't show toast notification)
      handleFetchFiles(repoUrl, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl, hasConnection, githubRepos.length])
  
  // Load files when component mounts with an existing repo URL
  useEffect(() => {
    if (currentRepoUrl && !repoUrl) {
      setRepoUrl(currentRepoUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRepoUrl])

  const handleSave = () => {
    startSaving(async () => {
      try {
        await updateProjectGithubRepo(projectId, repoUrl.trim(), selectedFiles)
        toast.success(t.settings.github.toast.settingsSaved)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t.settings.github.toast.failedToSave)
      }
    })
  }

  const handleUnlink = () => {
    setShowUnlinkDialog(true)
  }

  const confirmUnlink = () => {
    setShowUnlinkDialog(false)
    startUnlinking(async () => {
      try {
        await unlinkProjectGithubRepo(projectId)
        setRepoUrl("")
        setAvailableFiles([])
        setSelectedFiles([])
        toast.success(t.settings.github.toast.repoUnlinked)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t.settings.github.toast.failedToUnlink)
      }
    })
  }

  const toggleFile = (filePath: string) => {
    setSelectedFiles((prev) =>
      prev.includes(filePath)
        ? prev.filter((f) => f !== filePath)
        : [...prev, filePath]
    )
  }

  const hasChanges = 
    repoUrl !== (currentRepoUrl || "") ||
    JSON.stringify(selectedFiles.sort()) !== JSON.stringify(currentSelectedFiles.sort())

  // Check if user needs to link GitHub account
  const needsGitHubLink = !hasConnection && (!loggedInGithubAccount || !loggedInGithubAccount.isLinked)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Github className="h-5 w-5" />
              {t.settings.github.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {t.settings.github.description}
            </CardDescription>
          </div>
          {currentRepoUrl && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleUnlink}
              disabled={isUnlinking}
            >
                  {isUnlinking ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t.settings.github.unlinking}
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  {t.settings.github.unlink}
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoadingAccounts ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : needsGitHubLink ? (
          // User must link their GitHub account
          <div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {t.settings.github.accountRequired}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {loggedInGithubAccount 
                    ? t.settings.github.accountRequiredDescription
                    : t.settings.github.accountRequiredDescriptionNotLinked}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={handleConnectGithub}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t.settings.github.connecting}
                      </>
                    ) : (
                      <>
                        <Github className="h-4 w-4 mr-2" />
                        {t.settings.github.linkAccount}
                      </>
                    )}
                  </Button>
                  {loggedInGithubAccount && (
                    <Button
                      variant="outline"
                      onClick={handleManualSync}
                      disabled={isConnecting}
                    >
                      {t.settings.github.syncExistingInstallation}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* GitHub Account Selection (if multiple accounts) */}
            {githubAccounts.length > 1 && (
              <div className="space-y-2">
                <Label>{t.settings.github.selectAccountLabel}</Label>
                <Select
                  value={selectedAccountId || ""}
                  onValueChange={handleAccountChange}
                  disabled={isSaving || isDisconnecting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t.settings.github.selectAccount} />
                  </SelectTrigger>
                  <SelectContent>
                    {githubAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.githubUsername} {acc.isPrimary && t.settings.github.primary}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t.settings.github.chooseAccount}
                </p>
              </div>
            )}

            {/* GitHub Connection Status */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {hasConnection ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">{t.settings.github.accountLinked}</p>
                      <p className="text-xs text-muted-foreground">
                        {githubRepos.length > 0 
                          ? (githubRepos.length === 1 
                              ? t.settings.github.accessGrantedOne 
                              : t.settings.github.accessGranted.replace("{count}", String(githubRepos.length)))
                          : t.settings.github.loadingRepos}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">{t.settings.github.accountNotLinked}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.settings.github.linkAccountToAccess}
                      </p>
                    </div>
                  </>
                )}
              </div>
              {hasConnection ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnectGithub}
                  disabled={isDisconnecting || isUnlinking}
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.settings.github.disconnecting}
                    </>
                  ) : (
                    t.settings.github.disconnect
                  )}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleConnectGithub}
                  disabled={isConnecting || isUnlinking}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.settings.github.connecting}
                    </>
                  ) : (
                    <>
                      <Github className="h-4 w-4 mr-2" />
                      {t.settings.github.linkGitHub}
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Repository Selection */}
            {hasConnection && (
              <div className="space-y-4">
                {githubRepos.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{t.settings.github.selectRepository}</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUpdateRepos}
                        className="h-7 text-xs"
                      >
                        <Github className="h-3 w-3 mr-1" />
                        {t.settings.github.updateRepos}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={repoUrl}
                        onValueChange={handleRepoSelect}
                        disabled={isSaving || isUnlinking || isDisconnecting || isLoadingRepos}
                        className="flex-1"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingRepos ? t.settings.github.loadingRepos : t.settings.github.chooseRepository} />
                        </SelectTrigger>
                        <SelectContent>
                          {githubRepos.map((repo) => (
                            <SelectItem key={repo.fullName} value={repo.url}>
                              {repo.fullName} {repo.private && "(Private)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.github.reposDescription}
                    </p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground p-4 border rounded-lg">
                    {isLoadingRepos ? t.settings.github.loadingRepos : t.settings.github.noReposAvailable}
                  </div>
                )}
              </div>
            )}

            {currentRepoUrl && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{t.settings.github.linkedRepository}</span>
                <a
                  href={currentRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  {currentRepoUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* File Selection - Always show when repo URL and files are available */}
            {repoUrl && availableFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t.settings.github.selectFiles}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFetchFiles(repoUrl)}
                    disabled={isLoadingFiles}
                    className="h-7 text-xs"
                  >
                    {isLoadingFiles ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        {t.settings.github.refreshing}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {t.settings.github.refresh}
                      </>
                    )}
                  </Button>
                </div>
                <div className="border rounded-md p-4 max-h-[400px] overflow-y-auto space-y-2">
                  {availableFiles.map((filePath) => (
                    <div key={filePath} className="flex items-center space-x-2">
                      <Checkbox
                        id={`file-${filePath}`}
                        checked={selectedFiles.includes(filePath)}
                        onCheckedChange={() => toggleFile(filePath)}
                        disabled={isSaving || isUnlinking}
                      />
                      <Label
                        htmlFor={`file-${filePath}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {filePath}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.settings.github.fileSelected.replace("{selected}", String(selectedFiles.length)).replace("{total}", String(availableFiles.length))}
                </p>
              </div>
            )}

            {currentRepoUrl && availableFiles.length === 0 && !isLoadingFiles && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="text-sm text-muted-foreground">
                  {t.settings.github.selectRepoToSeeFiles}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFetchFiles(currentRepoUrl)}
                  disabled={isLoadingFiles}
                >
                  {isLoadingFiles ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t.settings.github.loading}
                    </>
                  ) : (
                    t.settings.github.refreshFiles
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
      {!needsGitHubLink && (
        <CardFooter>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || isUnlinking || !repoUrl}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t.settings.github.saving}
              </>
            ) : (
              t.settings.github.saveChanges
            )}
          </Button>
        </CardFooter>
      )}

      {/* Disconnect GitHub Account Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.github.disconnectDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.github.disconnectDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.settings.github.disconnectDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnectGithub} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.settings.github.disconnectDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink Repository Confirmation Dialog */}
      <AlertDialog open={showUnlinkDialog} onOpenChange={setShowUnlinkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.github.unlinkDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.github.unlinkDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.settings.github.unlinkDialog.cancel}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmUnlink} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t.settings.github.unlinkDialog.confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
