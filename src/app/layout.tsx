import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  title: "Yamix",
  description: "プライバシーファーストのAI相談プラットフォーム",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <Suspense
          fallback={
            <div className="w-full h-screen flex items-center justify-center">
              <span className="loading loading-spinner loading-lg" />
            </div>
          }
        >
          <div className="relative z-10 min-h-screen">{children}</div>
        </Suspense>
      </body>
    </html>
  );
}
