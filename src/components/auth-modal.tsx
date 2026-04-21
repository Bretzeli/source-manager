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

type OAuthProviderId = "github" | "atlassian"

type OAuthProviderConfig = {
  id: OAuthProviderId
  name: string
  icon: React.ComponentType<{ className?: string }>
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
              className={`w-full ${provider.bgClass} border-0`}
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
      bgClass: "bg-[#24292e] hover:bg-[#24292e]/90 dark:bg-[#24292e] dark:hover:bg-[#24292e]/90 text-white",
    },
    {
      id: "atlassian",
      name: t.oauth.atlassian,
      icon: AtlassianIcon,
      bgClass: "bg-[#0052cc] hover:bg-[#0052cc]/90 dark:bg-[#0052cc] dark:hover:bg-[#0052cc]/90 text-white",
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
