import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { AuthModalProvider } from "@/contexts/auth-modal-context";
import { ProjectProvider } from "@/contexts/project-context";
import { AuthModal } from "@/components/auth-modal";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/navbar";
import { AccountSettingsReauthClear } from "@/components/account-settings-reauth-clear";
import { ActiveThemeProvider } from "@/components/active-theme-provider";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Source Manager",
  description: "Source Manager Application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "antialiased font-sans",
        )}
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" disableTransitionOnChange>
          <ActiveThemeProvider>
            <AuthModalProvider>
              <ProjectProvider>
                <AccountSettingsReauthClear />
                <Navbar />
                {children}
                <AuthModal />
                <Toaster />
              </ProjectProvider>
            </AuthModalProvider>
          </ActiveThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
