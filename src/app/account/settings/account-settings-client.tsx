"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Link2, LogIn, Trash2, Unlink, UserCircle } from "lucide-react"
import { toast } from "sonner"
import {
  deleteAccount,
  getDisplayInformationSettings,
  getOAuthConflictPreview,
  getOAuthLoginSettings,
  getDeleteAccountVerificationStatus,
  markDeleteAccountReauthVerified,
  resolveOAuthConflictAfterVerification,
  unlinkOAuthAccount,
  updateAllowDifferentProviders,
  updateDisplayInformation,
  type LinkedOAuthAccount,
} from "@/app/actions/account"
import { signOut, useSession } from "@/lib/auth-client"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { useTranslations } from "@/lib/i18n"
import authClient from "@/lib/auth-client"
import { ProviderIcon, type OAuthProviderId } from "@/components/oauth-provider-icons"
import { getPresetAvatarDisplayLabel } from "@/data/avatar-preset-display-names"
import { avatarImageProps } from "@/lib/external-avatar-url"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Spinner } from "@/components/ui/spinner"

const CONFIRM_PHRASE = "DELETE"
const ACCOUNT_REAUTH_INTENT_KEY = "account-reauth-intent"
const ACCOUNT_REAUTH_RETURN_SECTION_KEY = "account-reauth-return-section"
const OAUTH_CONFLICT_PROVIDER_KEY = "account-oauth-conflict-provider"
const OAUTH_MERGE_CONFIRM_PHRASE = "DELETE"
const AVAILABLE_OAUTH_PROVIDERS = ["github", "google", "discord", "atlassian"] as const
const DISPLAY_IMAGE_DEFAULT = "__default__"

type AccountSection = "oauth" | "display" | "delete"

export default function AccountSettingsClient() {
  const { t, locale } = useTranslations()
  const router = useRouter()
  const { openModal } = useAuthModal()
  const { data: session, isPending, refetch: refetchSession } = useSession()

  const [confirmText, setConfirmText] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isReauthLoading, setIsReauthLoading] = useState(false)
  const [hasDeleteVerification, setHasDeleteVerification] = useState(false)
  const [isVerificationLoading, setIsVerificationLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<AccountSection>("oauth")
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedOAuthAccount[]>([])
  const [allowDifferentProviders, setAllowDifferentProviders] = useState(true)
  const [isOAuthLoading, setIsOAuthLoading] = useState(true)
  const [isToggleSaving, setIsToggleSaving] = useState(false)
  const [isLinkingProvider, setIsLinkingProvider] = useState<OAuthProviderId | null>(null)
  const [unlinkingAccountId, setUnlinkingAccountId] = useState<string | null>(null)
  const [conflictProvider, setConflictProvider] = useState<OAuthProviderId | null>(null)
  const [conflictConfirmText, setConflictConfirmText] = useState("")
  const [isConflictResolving, setIsConflictResolving] = useState(false)
  const [conflictPreview, setConflictPreview] = useState<{
    mode: "delete" | "keep"
    movedEmail: string | null
    retainedLinks: Array<{ providerId: string; email: string | null }>
  } | null>(null)
  const [displayLoading, setDisplayLoading] = useState(false)
  const [displaySaving, setDisplaySaving] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [displayEmail, setDisplayEmail] = useState("")
  const [displayImageChoice, setDisplayImageChoice] = useState<string>(DISPLAY_IMAGE_DEFAULT)
  const [displayEmailChoices, setDisplayEmailChoices] = useState<string[]>([])
  const [displayImageOptions, setDisplayImageOptions] = useState<
    Array<{ accountId: string; providerId: string; email: string; imageUrl: string | null }>
  >([])
  const [presetAvatarUrls, setPresetAvatarUrls] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    const syncVerification = async () => {
      if (!session?.user) {
        if (!cancelled) {
          setHasDeleteVerification(false)
          setIsVerificationLoading(false)
        }
        return
      }

      try {
        const intent = window.sessionStorage.getItem(ACCOUNT_REAUTH_INTENT_KEY)
        if (intent === "1") {
          await markDeleteAccountReauthVerified()
          window.sessionStorage.removeItem(ACCOUNT_REAUTH_INTENT_KEY)
        }

        const status = await getDeleteAccountVerificationStatus()
        if (!cancelled) {
          setHasDeleteVerification(status.verified)
          if (status.verified) {
            const returnSection = window.sessionStorage.getItem(ACCOUNT_REAUTH_RETURN_SECTION_KEY)
            if (returnSection === "delete" || returnSection === "oauth" || returnSection === "display") {
              setActiveSection(returnSection)
              window.sessionStorage.removeItem(ACCOUNT_REAUTH_RETURN_SECTION_KEY)
            }
          }
        }
      } catch {
        if (!cancelled) {
          setHasDeleteVerification(false)
        }
      } finally {
        if (!cancelled) {
          setIsVerificationLoading(false)
        }
      }
    }

    void syncVerification()

    return () => {
      cancelled = true
    }
  }, [session?.user])

  useEffect(() => {
    if (!session?.user) {
      setLinkedAccounts([])
      setAllowDifferentProviders(true)
      setIsOAuthLoading(false)
      return
    }

    let cancelled = false

    const loadOAuthSettings = async () => {
      try {
        setIsOAuthLoading(true)
        const settings = await getOAuthLoginSettings()
        if (!cancelled) {
          setLinkedAccounts(settings.linkedAccounts)
          setAllowDifferentProviders(settings.allowDifferentProviders)
        }
      } catch {
        if (!cancelled) {
          toast.error(t.errors.generic)
        }
      } finally {
        if (!cancelled) {
          setIsOAuthLoading(false)
        }
      }
    }

    void loadOAuthSettings()

    return () => {
      cancelled = true
    }
  }, [session?.user, t.errors.generic])

  useEffect(() => {
    if (!session?.user || activeSection !== "display") {
      return
    }

    let cancelled = false

    const loadDisplay = async () => {
      try {
        setDisplayLoading(true)
        const data = await getDisplayInformationSettings()
        if (cancelled) return
        setDisplayName(data.displayName)
        setDisplayEmail(data.displayEmail)
        setDisplayEmailChoices(data.emailChoices)
        setDisplayImageOptions(data.imageOptions)
        setPresetAvatarUrls(data.presetAvatarUrls ?? [])
        setDisplayImageChoice(
          data.displayImageAccountId ??
            data.selectedPresetAvatarUrl ??
            DISPLAY_IMAGE_DEFAULT,
        )
      } catch {
        if (!cancelled) {
          toast.error(t.errors.generic)
        }
      } finally {
        if (!cancelled) {
          setDisplayLoading(false)
        }
      }
    }

    void loadDisplay()

    return () => {
      cancelled = true
    }
  }, [session?.user, activeSection, t.errors.generic])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get("error")
    if (!error) return

    const normalized = decodeURIComponent(error).toLowerCase()
    if (
      normalized.includes("disabled login with different providers") ||
      normalized.includes("disabled automatic cross-provider linking")
    ) {
      toast.error(t.account.oauth.crossProviderDisabledError)
    } else if (normalized.includes("account_not_linked")) {
      toast.error(t.account.oauth.accountNotLinkedForProviderError)
    } else if (normalized.includes("account_already_linked_to_different_user")) {
      const storedProvider = window.sessionStorage.getItem(OAUTH_CONFLICT_PROVIDER_KEY)
      if (
        storedProvider &&
        AVAILABLE_OAUTH_PROVIDERS.includes(storedProvider as OAuthProviderId)
      ) {
        const provider = storedProvider as OAuthProviderId
        setConflictProvider(provider)
        void (async () => {
          try {
            const preview = await getOAuthConflictPreview(provider)
            setConflictPreview(preview)
          } catch {
            setConflictPreview(null)
          }
        })()
      } else {
        toast.error(t.account.oauth.accountAlreadyLinkedError)
      }
    } else {
      toast.error(error)
    }

    params.delete("error")
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`
    window.history.replaceState({}, "", cleanUrl)
  }, [
    t.account.oauth.accountAlreadyLinkedError,
    t.account.oauth.accountNotLinkedForProviderError,
    t.account.oauth.crossProviderDisabledError,
  ])

  const needsReauth = !hasDeleteVerification
  const linkableProviders: OAuthProviderId[] = [...AVAILABLE_OAUTH_PROVIDERS]
  const canUnlink = linkedAccounts.length > 1
  const providerLabel = (providerId: string) => {
    if (providerId === "github") return t.oauth.github
    if (providerId === "google") return t.oauth.google
    if (providerId === "discord") return t.oauth.discord
    if (providerId === "atlassian") return t.oauth.atlassian
    return providerId
  }

  const handleReLogin = async (returnSection: AccountSection) => {
    try {
      setIsReauthLoading(true)
      setActiveSection(returnSection)
      window.sessionStorage.setItem(ACCOUNT_REAUTH_INTENT_KEY, "1")
      window.sessionStorage.setItem(ACCOUNT_REAUTH_RETURN_SECTION_KEY, returnSection)
      await signOut()
      openModal("login", true)
    } catch {
      window.location.href = "/"
    } finally {
      setIsReauthLoading(false)
    }
  }

  const handleDelete = async () => {
    if (confirmText.trim().toUpperCase() !== CONFIRM_PHRASE) {
      toast.error(t.account.delete.confirmPhraseError)
      return
    }

    try {
      setIsDeleting(true)
      await deleteAccount()
      toast.success(t.account.delete.deletedToast)
      try {
        await signOut()
      } finally {
        window.location.href = "/"
      }
    } catch (error) {
      if (error instanceof Error && error.message === "REAUTH_REQUIRED") {
        toast.error(t.account.delete.reauthRequiredToast)
        return
      }
      toast.error(error instanceof Error ? error.message : t.errors.generic)
    } finally {
      setIsDeleting(false)
      setDialogOpen(false)
    }
  }

  const refreshOAuthSettings = async () => {
    const settings = await getOAuthLoginSettings()
    setLinkedAccounts(settings.linkedAccounts)
    setAllowDifferentProviders(settings.allowDifferentProviders)
  }

  const handleToggleAllowDifferentProviders = async (nextValue: boolean) => {
    const previous = allowDifferentProviders
    setAllowDifferentProviders(nextValue)
    setIsToggleSaving(true)
    try {
      await updateAllowDifferentProviders(nextValue)
      setHasDeleteVerification(false)
      toast.success(t.account.oauth.providerPolicySavedToast)
    } catch (error) {
      if (error instanceof Error && error.message === "REAUTH_REQUIRED") {
        setHasDeleteVerification(false)
        toast.error(t.account.oauth.reauthRequiredToast)
        return
      }
      setAllowDifferentProviders(previous)
      toast.error(t.errors.generic)
    } finally {
      setIsToggleSaving(false)
    }
  }

  const handleLinkProvider = async (provider: OAuthProviderId) => {
    try {
      setIsLinkingProvider(provider)
      window.sessionStorage.setItem(OAUTH_CONFLICT_PROVIDER_KEY, provider)
      const result = await authClient.linkSocial({
        provider,
        callbackURL: window.location.href,
        errorCallbackURL: window.location.href,
      })
      if (result?.error) {
        toast.error(result.error.message || t.errors.generic)
        window.sessionStorage.removeItem(OAUTH_CONFLICT_PROVIDER_KEY)
        setIsLinkingProvider(null)
        return
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.errors.generic)
      window.sessionStorage.removeItem(OAUTH_CONFLICT_PROVIDER_KEY)
      setIsLinkingProvider(null)
    }
  }

  const handleResolveConflict = async () => {
    if (!conflictProvider) return
    const needsDeleteConfirm = conflictPreview?.mode !== "keep"
    if (needsDeleteConfirm && conflictConfirmText.trim().toUpperCase() !== OAUTH_MERGE_CONFIRM_PHRASE) {
      toast.error(
        t.account.oauth.linkConflictConfirmPhraseError.replace("{phrase}", OAUTH_MERGE_CONFIRM_PHRASE),
      )
      return
    }

    try {
      setIsConflictResolving(true)
      const result = await resolveOAuthConflictAfterVerification(conflictProvider)
      window.sessionStorage.removeItem(OAUTH_CONFLICT_PROVIDER_KEY)
      setConflictProvider(null)
      setConflictConfirmText("")
      setConflictPreview(null)
      toast.success(
        result.sourceUserDeleted
          ? t.account.oauth.mergeCompletedDeletedSourceToast
          : t.account.oauth.mergeCompletedRetainedSourceToast,
      )
      await refreshOAuthSettings()
    } catch (error) {
      if (error instanceof Error && error.message === "REAUTH_REQUIRED") {
        setHasDeleteVerification(false)
        toast.error(t.account.oauth.reauthRequiredToast)
        return
      }
      if (error instanceof Error && error.message === "CONFLICT_ACCOUNT_NOT_IDENTIFIED") {
        toast.error(t.account.oauth.conflictCouldNotBeResolvedError)
      } else {
        toast.error(error instanceof Error ? error.message : t.errors.generic)
      }
    } finally {
      setIsConflictResolving(false)
    }
  }

  const handleSaveDisplayInformation = async () => {
    try {
      setDisplaySaving(true)
      const isDefault = displayImageChoice === DISPLAY_IMAGE_DEFAULT
      const isPreset = !isDefault && presetAvatarUrls.includes(displayImageChoice)
      await updateDisplayInformation({
        displayName,
        displayEmail,
        displayImageAccountId: !isDefault && !isPreset ? displayImageChoice : null,
        presetAvatarUrl: isPreset ? displayImageChoice : null,
      })
      toast.success(t.account.displayInformation.savedToast)
      await refetchSession?.()
      router.refresh()
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_DISPLAY_NAME") {
        toast.error(t.account.displayInformation.invalidNameToast)
      } else if (error instanceof Error && error.message === "INVALID_DISPLAY_EMAIL") {
        toast.error(t.account.displayInformation.invalidEmailToast)
      } else if (error instanceof Error && error.message === "INVALID_DISPLAY_IMAGE") {
        toast.error(t.account.displayInformation.invalidImageToast)
      } else if (error instanceof Error && error.message === "INVALID_PRESET_AVATAR") {
        toast.error(t.account.displayInformation.invalidPresetAvatarToast)
      } else {
        toast.error(error instanceof Error ? error.message : t.errors.generic)
      }
    } finally {
      setDisplaySaving(false)
    }
  }

  const handleUnlinkProvider = async (entry: LinkedOAuthAccount) => {
    try {
      setUnlinkingAccountId(entry.id)
      await unlinkOAuthAccount(entry.providerId, entry.accountId)
      await refreshOAuthSettings()
      toast.success(t.account.oauth.unlinkedToast)
    } catch (error) {
      if (error instanceof Error && error.message === "REAUTH_REQUIRED") {
        setHasDeleteVerification(false)
        toast.error(t.account.oauth.reauthRequiredToast)
        return
      }
      if (error instanceof Error && error.message === "LAST_OAUTH_PROVIDER") {
        toast.error(t.account.oauth.lastProviderError)
      } else {
        toast.error(error instanceof Error ? error.message : t.errors.generic)
      }
    } finally {
      setUnlinkingAccountId(null)
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{t.account.loginRequiredTitle}</CardTitle>
            <CardDescription>{t.account.loginRequiredDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => openModal("login", true)}>
              <LogIn className="mr-2 h-4 w-4" />
              {t.nav.logIn}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t.account.title}</h1>
        <p className="text-muted-foreground mt-1">{t.account.description}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside>
          <nav className="flex flex-col gap-1 rounded-lg border p-2">
            <Button
              variant={activeSection === "oauth" ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setActiveSection("oauth")}
            >
              <Link2 className="mr-2 h-4 w-4" />
              {t.account.oauth.menuItem}
            </Button>
            <Button
              variant={activeSection === "display" ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setActiveSection("display")}
            >
              <UserCircle className="mr-2 h-4 w-4" />
              {t.account.displayInformation.menuItem}
            </Button>
            <Button
              variant={activeSection === "delete" ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setActiveSection("delete")}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t.account.delete.menuItem}
            </Button>
          </nav>
        </aside>

        {activeSection === "display" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                {t.account.displayInformation.title}
              </CardTitle>
              <CardDescription>{t.account.displayInformation.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {displayLoading ? (
                <p className="text-sm text-muted-foreground">{t.account.displayInformation.loading}</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="display-name">{t.account.displayInformation.displayNameLabel}</Label>
                    <Input
                      id="display-name"
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      autoComplete="nickname"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t.account.displayInformation.displayNameHint}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.account.displayInformation.displayEmailLabel}</Label>
                    <Select value={displayEmail} onValueChange={setDisplayEmail}>
                      <SelectTrigger className="w-full max-w-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {displayEmailChoices.map((email) => (
                          <SelectItem key={email} value={email}>
                            {email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t.account.displayInformation.displayEmailHint}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label>{t.account.displayInformation.displayImageLabel}</Label>
                    <div className="flex flex-wrap gap-4">
                      <button
                        type="button"
                        className="flex flex-col items-center gap-2 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => setDisplayImageChoice(DISPLAY_IMAGE_DEFAULT)}
                      >
                        <span
                          className={`flex h-16 w-16 items-center justify-center rounded-full border-2 bg-muted ${
                            displayImageChoice === DISPLAY_IMAGE_DEFAULT
                              ? "border-primary"
                              : "border-transparent"
                          }`}
                        >
                          <UserCircle className="h-9 w-9 text-muted-foreground" />
                        </span>
                        <span className="text-xs text-center max-w-[5.5rem]">
                          {t.account.displayInformation.defaultAvatarLabel}
                        </span>
                      </button>
                      {presetAvatarUrls.map((url) => (
                        <button
                          key={url}
                          type="button"
                          className="flex flex-col items-center gap-2 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setDisplayImageChoice(url)}
                        >
                          <span
                            className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-muted ${
                              displayImageChoice === url ? "border-primary" : "border-transparent"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" className="h-full w-full object-cover" />
                          </span>
                          <span className="text-xs text-center max-w-[5.5rem] leading-tight break-all">
                            {getPresetAvatarDisplayLabel(url, locale)}
                          </span>
                        </button>
                      ))}
                      {displayImageOptions.map((option) => (
                        <button
                          key={option.accountId}
                          type="button"
                          className="flex flex-col items-center gap-2 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setDisplayImageChoice(option.accountId)}
                        >
                          <span
                            className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 bg-muted ${
                              displayImageChoice === option.accountId
                                ? "border-primary"
                                : "border-transparent"
                            }`}
                          >
                            {option.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                {...avatarImageProps(option.imageUrl)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ProviderIcon
                                provider={option.providerId as OAuthProviderId}
                                className="h-8 w-8 opacity-70"
                              />
                            )}
                          </span>
                          <span className="text-xs text-center max-w-[5.5rem] leading-tight">
                            {providerLabel(option.providerId)}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.account.displayInformation.displayImageHint}
                    </p>
                  </div>

                  <Button onClick={() => void handleSaveDisplayInformation()} disabled={displaySaving}>
                    {displaySaving
                      ? t.account.displayInformation.saving
                      : t.account.displayInformation.saveAction}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : activeSection === "oauth" ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                {t.account.oauth.title}
              </CardTitle>
              <CardDescription>{t.account.oauth.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-md border p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-medium">{t.account.oauth.preventCrossProviderTitle}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.account.oauth.preventCrossProviderDescription}
                    </p>
                  </div>
                  <Switch
                    checked={!allowDifferentProviders}
                    disabled={isOAuthLoading || isToggleSaving || needsReauth}
                    onCheckedChange={(checked) => void handleToggleAllowDifferentProviders(!checked)}
                    aria-label={t.account.oauth.preventCrossProviderTitle}
                  />
                </div>
                {needsReauth ? (
                  <p className="text-xs text-muted-foreground">{t.account.oauth.reauthRequiredHint}</p>
                ) : null}
              </div>

              <div className="rounded-md border p-4 space-y-3">
                <p className="font-medium">{t.account.oauth.linkedProvidersTitle}</p>
                {isOAuthLoading ? (
                  <p className="text-sm text-muted-foreground">{t.account.oauth.loadingProviders}</p>
                ) : linkedAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.account.oauth.noLinkedProviders}</p>
                ) : (
                  <div className="space-y-2">
                    {linkedAccounts.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <ProviderIcon provider={entry.providerId as OAuthProviderId} className="h-4 w-4" />
                          <span>
                            {providerLabel(entry.providerId)}
                            {entry.email ? (
                              <span className="ml-2 text-xs text-muted-foreground">{entry.email}</span>
                            ) : null}
                          </span>
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canUnlink || unlinkingAccountId === entry.id || needsReauth}
                          onClick={() => void handleUnlinkProvider(entry)}
                        >
                          <Unlink className="mr-2 h-4 w-4" />
                          {t.account.oauth.unlinkAction}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {!canUnlink && linkedAccounts.length > 0 && (
                  <p className="text-xs text-muted-foreground">{t.account.oauth.lastProviderHint}</p>
                )}
              </div>

              <div className="rounded-md border p-4 space-y-3">
                <p className="font-medium">{t.account.oauth.linkProvidersTitle}</p>
                {linkableProviders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.account.oauth.allProvidersLinked}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {linkableProviders.map((provider) => (
                      <Button
                        key={provider}
                        variant="outline"
                        className={
                          provider === "github"
                            ? "border-0 bg-[#24292e] hover:bg-[#24292e]/90 text-white dark:bg-[#2f363d] dark:hover:bg-[#3a424a]"
                            : provider === "google"
                              ? "border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-100"
                              : provider === "discord"
                                ? "border-0 bg-[#5865F2] hover:bg-[#5865F2]/90 text-white dark:bg-[#4752c4] dark:hover:bg-[#5865F2]"
                                : "border border-gray-200 bg-white hover:bg-gray-50 text-[#0052CC] dark:border-[#2a4e8a] dark:bg-[#0f172a] dark:hover:bg-[#111f3d] dark:text-[#78a9ff]"
                        }
                        disabled={Boolean(isLinkingProvider) || needsReauth}
                        onClick={() => void handleLinkProvider(provider)}
                      >
                        <ProviderIcon provider={provider} className="mr-2 h-4 w-4" />
                        {providerLabel(provider)}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              {needsReauth ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-sm mb-3">{t.account.oauth.reauthDescription}</p>
                  <Button onClick={() => void handleReLogin("oauth")} disabled={isReauthLoading}>
                    {isReauthLoading ? t.account.oauth.reauthing : t.account.oauth.reauthAction}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                {t.account.delete.title}
              </CardTitle>
              <CardDescription>{t.account.delete.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t.account.delete.scope}</p>

              {needsReauth ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-sm mb-3">{t.account.delete.reauthDescription}</p>
                  <Button onClick={() => void handleReLogin("delete")} disabled={isReauthLoading}>
                    {isReauthLoading ? t.account.delete.reauthing : t.account.delete.reauthAction}
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border p-4 space-y-3">
                  <Label htmlFor="confirm-delete">
                    {t.account.delete.confirmPhraseLabel.replace("{phrase}", CONFIRM_PHRASE)}
                  </Label>
                  <Input
                    id="confirm-delete"
                    value={confirmText}
                    onChange={(event) => setConfirmText(event.target.value)}
                    placeholder={CONFIRM_PHRASE}
                    autoComplete="off"
                  />
                </div>
              )}

              <Button
                variant="destructive"
                disabled={needsReauth || isDeleting || isVerificationLoading}
                onClick={() => setDialogOpen(true)}
              >
                {isDeleting ? t.account.delete.deleting : t.account.delete.action}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.account.delete.dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.account.delete.dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t.home.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault()
                void handleDelete()
              }}
            >
              {isDeleting ? t.account.delete.deleting : t.account.delete.confirmAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(conflictProvider)}
        onOpenChange={(open) => {
          if (!open && !isConflictResolving) {
            setConflictProvider(null)
            setConflictConfirmText("")
            setConflictPreview(null)
            window.sessionStorage.removeItem(OAUTH_CONFLICT_PROVIDER_KEY)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.account.oauth.linkConflictTitle}</AlertDialogTitle>
          </AlertDialogHeader>

          <div className="space-y-3 text-sm">
            {conflictPreview?.mode === "keep" ? (
              <>
                <p>{t.account.oauth.linkConflictKeepMessage}</p>
                <p className="text-muted-foreground">{t.account.oauth.linkConflictKeepLinksTitle}</p>
                <div className="rounded-md border p-3 space-y-2">
                  {conflictPreview.retainedLinks.map((entry, index) => (
                    <div key={`${entry.providerId}-${entry.email ?? "no-email"}-${index}`} className="text-xs">
                      {providerLabel(entry.providerId)}{entry.email ? ` - ${entry.email}` : ""}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>{t.account.oauth.linkConflictRuleAllDeleted}</p>
            )}
          </div>

          {conflictPreview?.mode !== "keep" ? (
            <div className="space-y-2">
              <Label htmlFor="oauth-conflict-confirm">
                {t.account.oauth.linkConflictConfirmPhraseLabel.replace(
                  "{phrase}",
                  OAUTH_MERGE_CONFIRM_PHRASE,
                )}
              </Label>
              <Input
                id="oauth-conflict-confirm"
                value={conflictConfirmText}
                onChange={(event) => setConflictConfirmText(event.target.value)}
                placeholder={OAUTH_MERGE_CONFIRM_PHRASE}
                autoComplete="off"
                className="border-destructive/25 focus-visible:border-destructive/45 focus-visible:ring-destructive/15 dark:border-destructive/35 dark:focus-visible:ring-destructive/20"
              />
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConflictResolving}>
              {t.home.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isConflictResolving}
              onClick={(event) => {
                event.preventDefault()
                void handleResolveConflict()
              }}
            >
              {isConflictResolving
                ? t.account.oauth.linking
                : conflictPreview?.mode === "keep"
                  ? t.account.oauth.linkConflictContinueAction
                  : t.account.oauth.linkConflictDeleteAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  )
}
