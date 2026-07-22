import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import SearchBar from "@/components/SearchBar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className="bg-background text-foreground flex antialiased selection:bg-primary/30">
      <div className="hidden md:block w-28 shrink-0"/>
        <Sidebar/>
      <div className="flex-1 flex flex-col min-h-dvh min-w-0 overflow-x-hidden">
        <header className='sticky top-0 z-40 w-full pt-4 md:pt-8 px-4 md:px-8 flex justify-start items-center shrink-0'>
          <SearchBar/>
        </header>
        <main className="flex-1 min-h-dvh">
          {children}
        </main>
      </div>
      </body>
    </html>
  );
}
