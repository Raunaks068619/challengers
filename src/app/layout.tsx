import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from 'sonner';
import StoreProvider from "./StoreProvider";
import { Suspense } from "react";
import BottomNav from "@/common/BottomNav";
import ComponentVisibilityGuard from "@/common/ComponentVisibilityGuard";
import InstallPrompt from "@/components/InstallPrompt";
import ForegroundNotificationListener from "@/components/ForegroundNotificationListener";
import { ThemeProvider } from "@/components/theme-provider";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Challengers",
  description: "Push your limits. Bet on yourself.",
  manifest: "/manifest.json",
};
export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import NotificationManager from "@/components/NotificationManager";

import ThemeSync from "@/components/ThemeSync";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={poppins.className}>
        <StoreProvider>
          <Suspense fallback={null}>
            <AuthProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <ThemeSync />
                <NotificationManager />
                <div className="pb-20">
                  <div className="pb-20">
                    {children}
                  </div>
                </div>
                <ComponentVisibilityGuard allowedRoutes={['/', '/profile', '/social', '/challenges']}>
                  <BottomNav />
                </ComponentVisibilityGuard>
                <Toaster position="top-center" />
              </ThemeProvider>
            </AuthProvider>
          </Suspense>
        </StoreProvider>
      </body>
    </html>
  );
}
