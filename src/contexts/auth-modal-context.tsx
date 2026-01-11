"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

interface AuthModalContextType {
  isOpen: boolean
  defaultMode: "login" | "signup"
  fullyCover: boolean
  openModal: (mode?: "login" | "signup", fullyCover?: boolean) => void
  closeModal: () => void
  onSuccess?: () => void
  setOnSuccess: (callback: () => void) => void
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined
)

export function AuthModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [defaultMode, setDefaultMode] = useState<"login" | "signup">("login")
  const [fullyCover, setFullyCover] = useState(false)
  const [onSuccess, setOnSuccessCallback] = useState<(() => void) | undefined>(
    undefined
  )

  const openModal = useCallback((mode: "login" | "signup" = "login", cover = false) => {
    setDefaultMode(mode)
    setFullyCover(cover)
    setIsOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsOpen(false)
    if (onSuccess) {
      onSuccess()
      setOnSuccessCallback(undefined)
    }
  }, [onSuccess])

  const setOnSuccess = useCallback((callback: () => void) => {
    setOnSuccessCallback(() => callback)
  }, [])

  return (
    <AuthModalContext.Provider
      value={{
        isOpen,
        defaultMode,
        fullyCover,
        openModal,
        closeModal,
        onSuccess,
        setOnSuccess,
      }}
    >
      {children}
    </AuthModalContext.Provider>
  )
}

export function useAuthModal() {
  const context = useContext(AuthModalContext)
  if (context === undefined) {
    throw new Error("useAuthModal must be used within an AuthModalProvider")
  }
  return context
}

