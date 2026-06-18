import type { Metadata } from "next";

import { Analytics } from "@vercel/analytics/next";

import { SiteHeader } from "@/components/layout/site-header";
import { getAppUrl } from "@/lib/app-url";

import "./globals.css";

const appName = "AI Ecommerce Designer";
const appDescription =
  "Generate marketplace-ready ecommerce prompts, product images, and detail page assets from a single product photo.";
const appUrl = getAppUrl();

export const metadata: Metadata = {
  alternates: {
    canonical: appUrl,
  },
  applicationName: appName,
  description: appDescription,
  metadataBase: new URL(appUrl),
  openGraph: {
    description: appDescription,
    locale: "en_US",
    siteName: appName,
    title: appName,
    type: "website",
    url: appUrl,
  },
  robots: {
    follow: true,
    index: true,
  },
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  twitter: {
    card: "summary_large_image",
    description: appDescription,
    title: appName,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
        <Analytics />
      </body>
    </html>
  );
}
