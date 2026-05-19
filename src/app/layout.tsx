import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AetherOps | Autonomous AI Operations Platform",
  description:
    "The category-defining operations layer for AI-native companies. Automate intake, safety checks, and fulfillment with a rigorous audit trail.",
  keywords: ["AISM", "AI Operations", "Autonomous Operations", "AI Governance", "Agentic Workflows"],
  authors: [{ name: "AetherOps Team" }],
  openGraph: {
    title: "AetherOps | Autonomous AI Operations Platform",
    description: "The category-defining operations layer for AI-native companies.",
    siteName: "AetherOps",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
