import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import "./globals.css";

const sarasaGothic = localFont({
  src: [{ path: "./fonts/SarasaGothicJ-Regular.ttf", weight: "400" }],
  preload: true,
  display: "swap",
  variable: "--font-sarasa-gothic",
});

function detectLanguage(acceptLanguage: string | null): string {
  if (!acceptLanguage) return "ja";
  const lang = acceptLanguage.split(",")[0].split("-")[0];
  return ["ja", "en", "ko"].includes(lang) ? lang : "ja";
}

const siteUrl = process.env.WEB_URL || "https://mix.yami.ski";

export const metadata: Metadata = {
  title: {
    default: "やみっくす - AI相談プラットフォーム",
    template: "%s | やみっくす",
  },
  description: "プライバシーファーストのAI相談プラットフォーム。悩みを匿名でAIや人間に相談できます。",
  keywords: ["AI相談", "悩み相談", "メンタルヘルス", "匿名相談", "Misskey"],
  authors: [{ name: "Yamix Team" }],
  metadataBase: new URL(siteUrl),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yamix",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: siteUrl,
    siteName: "やみっくす",
    title: "やみっくす - AI相談プラットフォーム",
    description: "プライバシーファーストのAI相談プラットフォーム。悩みを匿名でAIや人間に相談できます。",
    images: [
      {
        url: "/og-image.gif",
        width: 540,
        height: 304,
        alt: "やみっくす",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "やみっくす - AI相談プラットフォーム",
    description: "プライバシーファーストのAI相談プラットフォーム",
    images: ["/og-image.gif"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#A374FF",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const lng = detectLanguage(headersList.get("accept-language"));

  return (
    <html lang={lng} data-theme="dark">
      <body className={`${sarasaGothic.variable} relative min-h-screen`}>
        <ThemeProvider>
          <ToastProvider>
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="w-full h-screen flex items-center justify-center">
                    <span className="loading loading-spinner loading-lg" />
                  </div>
                }
              >
                <div className="relative z-10 min-h-screen">{children}</div>
              </Suspense>
            </ErrorBoundary>
          </ToastProvider>
          <ServiceWorkerRegister />
        </ThemeProvider>
      </body>
    </html>
  );
}
