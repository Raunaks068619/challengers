import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from 'sonner';
import StoreProvider from "./StoreProvider";
import { Suspense } from "react";
import RefreshButton from "@/components/RefreshButton";

const inter = Inter({ subsets: ["latin"] });

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <StoreProvider>
          <Suspense fallback={null}>
            <AuthProvider>
              {children}
              <RefreshButton />
              <Toaster position="top-center" theme="dark" />
            </AuthProvider>
          </Suspense>
        </StoreProvider>
      </body>
    </html>
  );
}
