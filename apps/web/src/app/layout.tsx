import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLOODHOUND — On-Chain Intelligence for Solana",
  description:
    "Track wallets. Map relationships. Follow the money. The intelligence layer for Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          {/* JetBrains Mono — monospace for all addresses and data */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
          {/* Inter — UI sans-serif fallback for Neue Haas Grotesk */}
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
