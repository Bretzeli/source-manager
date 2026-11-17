"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { LockKeyhole, LogIn, ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { signOut } from "@/lib/auth-client"
import { useTranslations } from "@/lib/i18n"

type ProjectAccessDeniedProps =
  | { status: "signed-out"; userName?: undefined }
  | { status: "forbidden"; userName: string }

/**
 * Shown at a project's URL to visitors who may not open it. Signing in returns to the current
 * URL (the OAuth callback is the page itself), so the owner lands directly in the project.
 */
export function ProjectAccessDenied({ status, userName }: ProjectAccessDeniedProps) {
  const { t } = useTranslations()
  const ta = t.projectAccess
  const { openModal } = useAuthModal()
  const router = useRouter()
  const signedOut = status === "signed-out"

  const useAnotherAccount = async () => {
    await signOut()
    // Re-render the guard as signed out, then offer to sign in with a different account.
    router.refresh()
    openModal("login")
  }

  const [before, after] = ta.forbiddenDescription.split("{name}")

  return (
    <main data-project-access-denied className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <Empty className="max-w-md">
        <EmptyHeader>
          <EmptyMedia variant="icon">{signedOut ? <LockKeyhole /> : <ShieldX />}</EmptyMedia>
          <EmptyTitle className="text-lg">{signedOut ? ta.signedOutTitle : ta.forbiddenTitle}</EmptyTitle>
          <EmptyDescription>
            {signedOut ? (
              ta.signedOutDescription
            ) : (
              <>
                {before}
                <span className="text-foreground font-medium">{userName}</span>
                {after}
              </>
            )}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            {signedOut ? (
              <>
                <Button onClick={() => openModal("login")}>
                  <LogIn />
                  {ta.signIn}
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/">{ta.homeSignedOut}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild>
                  <Link href="/">{ta.home}</Link>
                </Button>
                <Button variant="outline" onClick={useAnotherAccount}>
                  {ta.switchAccount}
                </Button>
              </>
            )}
          </div>
        </EmptyContent>
      </Empty>
    </main>
  )
}
