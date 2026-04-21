"use client"

import * as React from "react"
import { Github } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { useTranslations } from "@/lib/i18n"
import { authClient } from "@/lib/auth-client"

// Google "G" mark (brand colors; not the full-color logo asset)
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

// Atlassian icon component (SVG)
function AtlassianIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M7.93 11.746c0-.868-.527-1.604-1.316-1.928v-.003c-.79-.324-1.682-.072-2.277.618l-4.323 5.397a.782.782 0 00-.013 1.006l.012.014 4.324 5.398c.595.689 1.487.941 2.276.618.79-.324 1.316-1.06 1.316-1.928V11.746zm16.146 1.58a.784.784 0 00.013-1.007l-.013-.013-4.324-5.398c-.594-.69-1.487-.942-2.276-.618-.79.324-1.316 1.06-1.316 1.928v8.084c0 .868.527 1.603 1.316 1.927v.003c.79.324 1.682.072 2.277-.618l4.323-5.397zm-10.298 8.189c-1.094 0-2.05-.56-2.61-1.41L.227 9.662C-.39 8.68.001 7.352 1.003 6.765a2.408 2.408 0 011.092-.262c.747 0 1.456.302 1.985.836l6.752 8.155 6.752-8.155c.53-.534 1.238-.836 1.985-.836.385 0 .772.09 1.092.262 1.002.587 1.393 1.915.776 2.897l-9.94 12.443c-.56.85-1.516 1.41-2.61 1.41z" />
    </svg>
  )
}

type OAuthProviderId = "github" | "google" | "atlassian"

type OAuthProviderConfig = {
  id: OAuthProviderId
  name: string
  icon: React.ComponentType<{ className?: string }>
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
          const Icon = provider.icon
          return (
            <Button
              key={provider.id}
              type="button"
              variant="outline"
              className={`w-full ${provider.bgClass}`}
              onClick={() => onOAuth(provider.id)}
              disabled={isLoading}
            >
              <Icon className="mr-2 h-5 w-5" />
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
      icon: Github,
      bgClass:
        "border-0 bg-[#24292e] hover:bg-[#24292e]/90 dark:bg-[#24292e] dark:hover:bg-[#24292e]/90 text-white",
    },
    {
      id: "google",
      name: t.oauth.google,
      icon: GoogleIcon,
      bgClass:
        "border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-300 dark:bg-white dark:hover:bg-gray-100 text-gray-800",
    },
    {
      id: "atlassian",
      name: t.oauth.atlassian,
      icon: AtlassianIcon,
      bgClass:
        "border-0 bg-[#0052cc] hover:bg-[#0052cc]/90 dark:bg-[#0052cc] dark:hover:bg-[#0052cc]/90 text-white",
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
