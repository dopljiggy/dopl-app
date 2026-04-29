import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { LoadingProvider } from "@/components/ui/aurora-loader";
import { ToastProvider } from "@/components/ui/toast";
import ServiceWorkerRegister from "@/components/pwa/sw-register";
import PWAInstallPrompt from "@/components/pwa/install-prompt";
import StandaloneSplash from "@/components/pwa/standalone-splash";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "dopl",
  description: "your portfolio, mirrored",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "dopl",
    description: "your portfolio, mirrored",
    type: "website",
    images: [
      {
        url: "/dopl-logo.png",
        width: 512,
        height: 512,
        alt: "dopl",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "dopl",
    description: "your portfolio, mirrored",
    images: ["/dopl-logo.png"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "dopl",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D261F",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${fraunces.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="dopl" />
      </head>
      <body
        className="min-h-screen text-dopl-cream antialiased"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <StandaloneSplash />
        <LoadingProvider>
          <ToastProvider>{children}</ToastProvider>
        </LoadingProvider>
        <PWAInstallPrompt />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
