import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";

import "@/app/globals.css";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"]
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "Work OS",
  description: "One-click workflow cockpit for Slack, Outlook, Jira, and Confluence"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${bodyFont.variable}`}
        style={{
          fontFamily: "var(--font-body)",
          WebkitFontSmoothing: "antialiased"
        }}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
