import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign-in error",
}

export default function OAuthErrorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
