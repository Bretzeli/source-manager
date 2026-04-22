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

// Discord icon component (official mark path)
function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.317 4.369a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.249.077.077 0 00-.079-.037A19.736 19.736 0 003.783 4.369a.07.07 0 00-.032.027C.533 9.046-.34 13.579.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 13.8 13.8 0 001.226-1.994.076.076 0 00-.041-.106 13.1 13.1 0 01-1.872-.892.077.077 0 01-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 01.078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.009c.12.1.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.04.107c.36.698.771 1.364 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.031-.056c.525-5.177-.838-9.673-3.549-13.66a.062.062 0 00-.031-.028zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.419 0 1.333-.955 2.419-2.157 2.419zm7.974 0c-1.183 0-2.157-1.086-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.211 0 2.176 1.095 2.157 2.419 0 1.333-.946 2.419-2.157 2.419z" />
    </svg>
  )
}

// Atlassian icon component (official mark geometry)
function AtlassianIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="atlassian-gradient"
          x1="99.6865531%"
          y1="15.8007988%"
          x2="39.8359011%"
          y2="97.4378355%"
        >
          <stop stopColor="#0052CC" offset="0%" />
          <stop stopColor="#2684FF" offset="92.3%" />
        </linearGradient>
      </defs>
      <g>
        <path
          d="M75.7929022,117.949352 C71.973435,113.86918 66.0220743,114.100451 63.4262382,119.292123 L0.791180865,244.565041 C-0.370000214,246.886207 -0.24632242,249.643151 1.11803323,251.85102 C2.48238888,254.058889 4.89280393,255.402741 7.48821365,255.402516 L94.716435,255.402516 C97.5716401,255.468706 100.19751,253.845601 101.414869,251.262074 C120.223468,212.37359 108.82814,153.245434 75.7929022,117.949352 Z"
          fill="url(#atlassian-gradient)"
        />
        <path
          d="M121.756071,4.0114918 C86.7234975,59.5164098 89.0348008,120.989508 112.109989,167.141287 L154.170383,251.262074 C155.438703,253.798733 158.031349,255.401095 160.867416,255.401115 L248.094235,255.401115 C250.689645,255.401339 253.10006,254.057487 254.464416,251.849618 C255.828771,249.64175 255.952449,246.884805 254.791268,244.563639 C254.791268,244.563639 137.44462,9.83670492 134.492768,3.96383607 C131.853481,-1.29371311 125.14944,-1.36519672 121.756071,4.0114918 Z"
          fill="#2681FF"
        />
      </g>
    </svg>
  )
}

type OAuthProviderId = "github" | "google" | "discord" | "atlassian"

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
      id: "discord",
      name: t.oauth.discord,
      icon: DiscordIcon,
      bgClass:
        "border-0 bg-[#5865F2] hover:bg-[#5865F2]/90 dark:bg-[#5865F2] dark:hover:bg-[#5865F2]/90 text-white",
    },
    {
      id: "atlassian",
      name: t.oauth.atlassian,
      icon: AtlassianIcon,
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
