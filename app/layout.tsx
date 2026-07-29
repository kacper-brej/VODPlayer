import type { Metadata } from "next";
import { Bodoni_Moda, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import PreconnectVideoOrigin from "@/components/layout/PreconnectVideoOrigin";
import {AuthProvider} from "@/lib/AuthContext";
import { getSearchIndex } from "@/lib/searchIndex";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni-moda",
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  style: ["normal"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Nocturna",
  description: "VOD Player",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const searchIndexPromise = getSearchIndex();

  return (
    <html
      lang="pl"
      className={`${geistSans.variable} ${geistMono.variable} ${bodoniModa.variable} h-full`}
    >
      <body className="font-ui bg-background text-foreground antialiased selection:bg-primary/30">
      <PreconnectVideoOrigin />
      <AuthProvider>
        <AppShell searchIndexPromise={searchIndexPromise}>
          {children}
        </AppShell>
      </AuthProvider>
      </body>
    </html>
  );
}
