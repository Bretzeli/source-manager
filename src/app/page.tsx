"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useAuthModal } from "@/contexts/auth-modal-context"
import { useSession } from "@/lib/auth-client"
import { authClient } from "@/lib/auth-client"

export default function Home() {
  const { openModal, isOpen } = useAuthModal()
  const { data: session, isPending } = useSession()
  const hasOpenedModalRef = useRef(false)

  // Check if user is authenticated and open modal if not
  useEffect(() => {
    // Only check once after session is loaded
    if (!isPending) {
      // If user is not authenticated and modal hasn't been opened yet, open it
      if (!session?.user && !isOpen && !hasOpenedModalRef.current) {
        hasOpenedModalRef.current = true
        openModal("login", true)
      } else if (session?.user) {
        // User is authenticated, reset the ref so modal can open again if needed
        hasOpenedModalRef.current = false
      }
    }
  }, [session, isPending, isOpen, openModal])

  // Show loading state while checking session
  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  // Show auth modal if not authenticated (background content)
  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black sm:items-start">
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
            <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
              Welcome to Source Manager
            </h1>
            <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
              Please log in to continue.
            </p>
          </div>
        </main>
      </div>
    )
  }

  // User is authenticated - show the actual home page
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            Welcome to Source Manager
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            You are logged in as <strong>{session.user.email || session.user.name}</strong>
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <Button
            onClick={async () => {
              await authClient.signOut()
              window.location.reload()
            }}
            variant="outline"
          >
            Sign Out
          </Button>
        </div>
      </main>
    </div>
  )
}
