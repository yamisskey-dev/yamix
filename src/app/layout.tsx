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
    default: "やみっくす",
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
    title: "やみっくす",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: siteUrl,
    siteName: "やみっくす",
    title: "やみっくす",
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
    title: "やみっくす",
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
    <html lang={lng} data-theme="dark" suppressHydrationWarning>
      <body className={`${sarasaGothic.variable} relative min-h-screen`} suppressHydrationWarning>
        <ThemeProvider>
          <ToastProvider>
            <ErrorBoundary>
              <Suspense
                fallback={
                  <div className="w-full h-screen flex items-center justify-center">
                    <div className="relative w-10 h-10">
                      <svg className="absolute inset-0 w-10 h-10 text-current opacity-25" viewBox="0 0 168 168" xmlns="http://www.w3.org/2000/svg">
                        <g transform="matrix(1.125,0,0,1.125,12,12)">
                          <circle cx="64" cy="64" r="64" style={{ fill: "none", stroke: "currentColor", strokeWidth: "21.33px" }} />
                        </g>
                      </svg>
                      <svg className="absolute inset-0 w-10 h-10 text-primary animate-spin" style={{ animationDuration: "0.5s" }} viewBox="0 0 168 168" xmlns="http://www.w3.org/2000/svg">
                        <g transform="matrix(1.125,0,0,1.125,12,12)">
                          <path d="M128,64C128,28.654 99.346,0 64,0C99.346,0 128,28.654 128,64Z" style={{ fill: "none", stroke: "currentColor", strokeWidth: "21.33px", strokeLinecap: "round" }} />
                        </g>
                      </svg>
                    </div>
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
