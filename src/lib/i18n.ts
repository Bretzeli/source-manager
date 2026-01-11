"use client"

import { useState, useEffect } from "react"

type Locale = "en" | "de"

const translations = {
  en: {
    appName: "Source Manager",
    login: {
      title: "Login",
      email: "Email",
      password: "Password",
      submit: "Sign In",
      switchToSignup: "Don't have an account? Sign up",
    },
    signup: {
      title: "Sign Up",
      email: "Email",
      password: "Password",
      name: "Name",
      submit: "Create Account",
      switchToLogin: "Already have an account? Sign in",
    },
    oauth: {
      continueWith: "Continue with",
      github: "GitHub",
      microsoft: "Microsoft",
      atlassian: "Atlassian",
      additionalMethods: "Additional login methods can be added later",
    },
    errors: {
      required: "This field is required",
      emailInvalid: "Please enter a valid email address",
      passwordMinLength: "Password must be at least 8 characters",
      generic: "An error occurred. Please try again.",
      invalidCredentials: "Invalid email or password",
    },
  },
  de: {
    appName: "Source Manager",
    login: {
      title: "Anmelden",
      email: "E-Mail",
      password: "Passwort",
      submit: "Anmelden",
      switchToSignup: "Noch kein Konto? Registrieren",
    },
    signup: {
      title: "Registrieren",
      email: "E-Mail",
      password: "Passwort",
      name: "Name",
      submit: "Konto erstellen",
      switchToLogin: "Bereits ein Konto? Anmelden",
    },
    oauth: {
      continueWith: "Weiter mit",
      github: "GitHub",
      microsoft: "Microsoft",
      atlassian: "Atlassian",
      additionalMethods: "Zusätzliche Anmeldemethoden können später hinzugefügt werden",
    },
    errors: {
      required: "Dieses Feld ist erforderlich",
      emailInvalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein",
      passwordMinLength: "Das Passwort muss mindestens 8 Zeichen lang sein",
      generic: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
      invalidCredentials: "Ungültige E-Mail oder Passwort",
    },
  },
} as const

function getLocale(): Locale {
  if (typeof window === "undefined") return "en"
  
  const browserLang = navigator.language || (navigator as any).userLanguage || "en"
  return browserLang.startsWith("de") ? "de" : "en"
}

export function useTranslations() {
  const [locale, setLocale] = useState<Locale>("en")

  useEffect(() => {
    setLocale(getLocale())
  }, [])

  return translations[locale]
}

export type Translations = typeof translations.en

