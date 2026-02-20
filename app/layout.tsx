import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import type { JSX, ReactNode } from "react";

import "@/app/globals.css";

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body"
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "LanMap",
  description: "Local pentest host file map dashboard"
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>): JSX.Element {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${monoFont.variable}`}>{children}</body>
    </html>
  );
}
