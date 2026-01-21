"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, MailIcon, Github } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { useTranslations } from "@/lib/i18n"
import { authClient } from "@/lib/auth-client"

// Microsoft icon component (SVG)
function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 23 23"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M0 0h11v11H0z" />
      <path d="M12 0h11v11H12z" />
      <path d="M0 12h11v11H0z" />
      <path d="M12 12h11v11H12z" />
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

interface AuthModalProps {
  fullyCover?: boolean
}

export function AuthModal({ fullyCover: propFullyCover }: AuthModalProps) {
  const { isOpen, defaultMode, fullyCover: contextFullyCover, closeModal } = useAuthModal()
  const fullyCover = propFullyCover ?? contextFullyCover
  const router = useRouter()
  const { t } = useTranslations()
  const [mode, setMode] = React.useState<"login" | "signup">(defaultMode)
  const [isLoading, setIsLoading] = React.useState(false)
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [name, setName] = React.useState("")

  React.useEffect(() => {
    setMode(defaultMode)
  }, [defaultMode])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (mode === "login") {
        const result = await authClient.signIn.email({
          email,
          password,
        })

        if (result.error) {
          toast.error(t.errors.invalidCredentials)
        } else {
          toast.success(`Welcome back!`)
          closeModal()
          // Wait a bit for session to update, then refresh
          setTimeout(() => {
            router.refresh()
          }, 100)
        }
      } else {
        const result = await authClient.signUp.email({
          email,
          password,
          name,
        })

        if (result.error) {
          toast.error(result.error.message || t.errors.generic)
        } else {
          toast.success(`Account created successfully!`)
          closeModal()
          // Wait a bit for session to update, then refresh
          setTimeout(() => {
            router.refresh()
          }, 100)
        }
      }
    } catch (error: any) {
      toast.error(error?.message || t.errors.generic)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: "github" | "microsoft" | "atlassian") => {
    try {
      setIsLoading(true)
      const result = await authClient.signIn.social({
        provider,
        callbackURL: window.location.href,
      })
      
      // Check if there's an error
      if (result?.error) {
        toast.error(result.error.message || `${t.oauth[provider]} ${t.errors.generic}. Please check your environment configuration.`)
        setIsLoading(false)
        return
      }
      
      // If successful, the redirect will happen automatically
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || t.errors.generic
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
    setEmail("")
    setPassword("")
    setName("")
  }

  const oauthProviders = [
    {
      id: "github" as const,
      name: t.oauth.github,
      icon: Github,
      bgClass: "bg-[#24292e] hover:bg-[#24292e]/90 dark:bg-[#24292e] dark:hover:bg-[#24292e]/90 text-white",
    },
    {
      id: "microsoft" as const,
      name: t.oauth.microsoft,
      icon: MicrosoftIcon,
      bgClass: "bg-[#0078d4] hover:bg-[#0078d4]/90 dark:bg-[#0078d4] dark:hover:bg-[#0078d4]/90 text-white",
    },
    {
      id: "atlassian" as const,
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

          {/* Tabs for Login/Signup */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">{t.login.title}</TabsTrigger>
              <TabsTrigger value="signup">{t.signup.title}</TabsTrigger>
            </TabsList>

            {/* Login Form */}
            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">{t.login.email}</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder={t.login.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">{t.login.password}</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      {t.login.submit}...
                    </>
                  ) : (
                    <>
                      <MailIcon className="mr-2 h-4 w-4" />
                      {t.login.submit}
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Signup Form */}
            <TabsContent value="signup" className="space-y-4 mt-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t.signup.name}</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder={t.signup.namePlaceholder}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t.signup.email}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder={t.signup.emailPlaceholder}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t.signup.password}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                      {t.signup.submit}...
                    </>
                  ) : (
                    <>
                      <MailIcon className="mr-2 h-4 w-4" />
                      {t.signup.submit}
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t.oauth.continueWith}
              </span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            {oauthProviders.map((provider) => {
              const Icon = provider.icon
              return (
                <Button
                  key={provider.id}
                  type="button"
                  variant="outline"
                  className={`w-full ${provider.bgClass} border-0`}
                  onClick={() => handleOAuthSignIn(provider.id)}
                  disabled={isLoading}
                >
                  <Icon className="mr-2 h-5 w-5" />
                  {provider.name}
                </Button>
              )
            })}
          </div>

          {/* Additional Methods Note */}
          <p className="text-xs text-center text-muted-foreground">
            {t.oauth.additionalMethods}
          </p>

          {/* Switch Mode Link */}
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

