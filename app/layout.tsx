import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  display: "swap",
});

const bodoniModa = localFont({
  src: "./fonts/BodoniModa-Latin-Variable.woff2",
  variable: "--font-bodoni-moda",
  weight: "400 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: false,
});

const bodoniModaExt = localFont({
  src: "./fonts/BodoniModa-LatinExt-Variable.woff2",
  variable: "--font-bodoni-moda-ext",
  weight: "400 900",
  style: "normal",
  display: "swap",
  adjustFontFallback: "Times New Roman",
});

export const metadata: Metadata = {
  title: "Nocturna",
  description: "VOD Player",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: "#07070A",
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html
          lang="pl"
          className={`${geistSans.variable} ${geistMono.variable} ${bodoniModa.variable} ${bodoniModaExt.variable} h-full`}
      >
      <body className="font-ui bg-background text-foreground antialiased selection:bg-primary/30">
      {children}
      </body>
      </html>
  );
}