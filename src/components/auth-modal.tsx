"use client"

import * as React from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { useTranslations } from "@/lib/i18n"
import { authClient } from "@/lib/auth-client"
import { ProviderIcon, type OAuthProviderId } from "@/components/oauth-provider-icons"

type OAuthProviderConfig = {
  id: OAuthProviderId
  name: string
  /** Tailwind classes for button surface (include border here; outline variant is neutral) */
  bgClass: string
}

function OAuthPanel({
  continueWithLabel,
  isLoading,
  oauthProviders,
  onOAuth,
}: {
  continueWithLabel: string
  isLoading: boolean
  oauthProviders: OAuthProviderConfig[]
  onOAuth: (provider: OAuthProviderId) => void
}) {
  return (
    <div className="flex flex-col gap-6 mt-4">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {continueWithLabel}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {oauthProviders.map((provider) => {
          return (
            <Button
              key={provider.id}
              type="button"
              variant="outline"
              className={`w-full ${provider.bgClass}`}
              onClick={() => onOAuth(provider.id)}
              disabled={isLoading}
            >
              <ProviderIcon provider={provider.id} className="mr-2 h-5 w-5" />
              {provider.name}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

interface AuthModalProps {
  fullyCover?: boolean
}

export function AuthModal({ fullyCover: propFullyCover }: AuthModalProps) {
  const { isOpen, defaultMode, fullyCover: contextFullyCover, closeModal } = useAuthModal()
  const fullyCover = propFullyCover ?? contextFullyCover
  const { t } = useTranslations()
  const [mode, setMode] = React.useState<"login" | "signup">(defaultMode)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    setMode(defaultMode)
  }, [defaultMode])

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const error = params.get("error")
    if (!error) return

    const normalized = decodeURIComponent(error).toLowerCase()
    if (
      normalized.includes("disabled login with different providers") ||
      normalized.includes("disabled automatic cross-provider linking")
    ) {
      toast.error(t.account.oauth.crossProviderDisabledError)
    }

    params.delete("error")
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`
    window.history.replaceState({}, "", cleanUrl)
  }, [t.account.oauth.crossProviderDisabledError])

  const handleOAuthSignIn = async (provider: OAuthProviderId) => {
    try {
      setIsLoading(true)
      const result = await authClient.signIn.social({
        provider,
        callbackURL: window.location.href,
      })

      if (result?.error) {
        toast.error(result.error.message || `${t.oauth[provider]} ${t.errors.generic}. Please check your environment configuration.`)
        setIsLoading(false)
        return
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error) || t.errors.generic
      if (errorMessage.includes("client_id") || errorMessage.includes("empty")) {
        toast.error(`${provider} OAuth is not properly configured. Please set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET in your environment variables.`)
      } else {
        toast.error(errorMessage)
      }
      setIsLoading(false)
    }
  }

  const handleSwitchMode = () => {
    setMode(mode === "login" ? "signup" : "login")
  }

  const oauthProviders: OAuthProviderConfig[] = [
    {
      id: "github",
      name: t.oauth.github,
      bgClass:
        "border-0 bg-[#24292e] hover:bg-[#24292e]/90 dark:bg-[#24292e] dark:hover:bg-[#24292e]/90 text-white",
    },
    {
      id: "google",
      name: t.oauth.google,
      bgClass:
        "border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-300 dark:bg-white dark:hover:bg-gray-100 text-gray-800",
    },
    {
      id: "discord",
      name: t.oauth.discord,
      bgClass:
        "border-0 bg-[#5865F2] hover:bg-[#5865F2]/90 dark:bg-[#5865F2] dark:hover:bg-[#5865F2]/90 text-white",
    },
    {
      id: "atlassian",
      name: t.oauth.atlassian,
      bgClass:
        "border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-300 dark:bg-white dark:hover:bg-gray-100 text-[#0052CC]",
    },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        className="sm:max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto"
        overlayClassName={fullyCover ? "bg-black/80" : "bg-black/50 backdrop-blur-sm"}
        showCloseButton={true}
      >
        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {t.appName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t.login.title}</TabsTrigger>
              <TabsTrigger value="signup">{t.signup.title}</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <OAuthPanel
                continueWithLabel={t.oauth.continueWith}
                isLoading={isLoading}
                oauthProviders={oauthProviders}
                onOAuth={handleOAuthSignIn}
              />
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <OAuthPanel
                continueWithLabel={t.oauth.continueWith}
                isLoading={isLoading}
                oauthProviders={oauthProviders}
                onOAuth={handleOAuthSignIn}
              />
            </TabsContent>
          </Tabs>

          <button
            type="button"
            onClick={handleSwitchMode}
            className="text-sm text-center text-primary hover:underline"
            disabled={isLoading}
          >
            {mode === "login" ? t.login.switchToSignup : t.signup.switchToLogin}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
