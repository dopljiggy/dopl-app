import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "dopl — infrastructure for fund managers",
  description: "Give your followers a way to invest alongside you. Connect your broker, create portfolios, set your price. dopl handles the rest.",
  openGraph: {
    title: "dopl — infrastructure for fund managers",
    description: "Give your followers a way to invest alongside you automatically.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-dopl-deep text-dopl-cream antialiased">
        {children}
      </body>
    </html>
  );
}
