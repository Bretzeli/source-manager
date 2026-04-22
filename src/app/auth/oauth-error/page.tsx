"use client"

import { Suspense } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useTranslations } from "@/lib/i18n"

function OAuthErrorContent() {
  const { t } = useTranslations()
  const router = useRouter()
  const searchParams = useSearchParams()
  const error = searchParams.get("error") ?? ""
  const errorDescription = searchParams.get("error_description") ?? ""

  const isUnableToLink = error === "unable_to_link_account"

  const handleBackToSignIn = () => {
    router.push("/?signIn=1")
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg flex-col justify-center px-4 py-12">
      <Card className="border-destructive/30 shadow-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-6 w-6 shrink-0" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">
              {t.authError.codeLabel}: {error || "—"}
            </span>
          </div>
          <CardTitle className="text-xl">
            {isUnableToLink ? t.authError.unableToLinkTitle : t.authError.genericTitle}
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            {isUnableToLink ? (
              <span className="block text-pretty">{t.authError.unableToLinkIntro}</span>
            ) : (
              <span className="block text-pretty">{t.authError.genericDescription}</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isUnableToLink ? (
            <div className="space-y-3 rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{t.authError.unableToLinkWhatYouCanDo}</p>
              <ul className="list-disc space-y-2 pl-4">
                <li>{t.authError.unableToLinkOptionA}</li>
                <li>{t.authError.unableToLinkOptionB}</li>
              </ul>
            </div>
          ) : null}
          {errorDescription && !isUnableToLink ? (
            <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">{errorDescription}</p>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button type="button" size="lg" className="sm:flex-1" onClick={handleBackToSignIn}>
              {t.authError.signInAgain}
            </Button>
            <Button type="button" size="lg" variant="outline" className="sm:flex-1" asChild>
              <Link href="/">{t.authError.goHome}</Link>
            </Button>
          </div>
          {isUnableToLink ? (
            <Button type="button" variant="ghost" className="w-full text-muted-foreground" asChild>
              <Link href="/account/settings">{t.authError.accountSettings}</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function OAuthErrorFallback() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

export default function OAuthErrorPage() {
  return (
    <Suspense fallback={<OAuthErrorFallback />}>
      <OAuthErrorContent />
    </Suspense>
  )
}
