import type { Metadata } from "next";

import { LanguageProvider } from "@/components/i18n/language-provider";
import { BackgroundGenerationProvider } from "@/components/generation/background-generation-provider";
import { SiteHeader } from "@/components/layout/site-header";
import { getAppUrl } from "@/lib/app-url";
import { getCurrentLanguage } from "@/lib/i18n-server";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const language = await getCurrentLanguage();

  return (
    <html lang={language === "zh" ? "zh-CN" : "en"}>
      <body>
        <LanguageProvider initialLanguage={language}>
          <BackgroundGenerationProvider>
            <SiteHeader language={language} />
            <main className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6">
              <div
                aria-hidden="true"
                className="app-shell-grid pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem]"
              />
              {children}
            </main>
          </BackgroundGenerationProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
