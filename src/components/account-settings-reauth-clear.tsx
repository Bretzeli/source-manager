"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { clearAccountReauthVerification } from "@/app/actions/account"

const ACCOUNT_SETTINGS_PATH = "/account/settings"

/**
 * Drops account re-auth verification as soon as the user navigates away from
 * account settings so delete/OAuth sensitive actions require re-login again.
 */
export function AccountSettingsReauthClear() {
  const pathname = usePathname()
  const prevPathnameRef = useRef<string | null>(null)

  useEffect(() => {
    const prev = prevPathnameRef.current
    if (prev === ACCOUNT_SETTINGS_PATH && pathname !== ACCOUNT_SETTINGS_PATH) {
      void clearAccountReauthVerification()
    }
    prevPathnameRef.current = pathname
  }, [pathname])

  return null
}
