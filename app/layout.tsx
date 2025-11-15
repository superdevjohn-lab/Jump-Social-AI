import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["100","200","300","400","500","600","700","800","900"],
  display: "swap",
  adjustFontFallback: false
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["100","200","300","400","500","600","700","800","900"],
  display: "swap",
  adjustFontFallback: false
});

export const metadata: Metadata = {
  title: "Jump Social AI",
  description: "Post-meeting social media content generator for advisors",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
