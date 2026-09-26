import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Newsreader } from "next/font/google";

import { ActivityProvider } from "@/components/activity";
import { Nav } from "@/components/nav";
import { BRAND } from "@/config/brand";

import "./globals.css";

// Inter is the grotesque, and it is the shipped face rather than a stand-in:
// the reference's custom Inter variant is licensed, plain Inter is not.
const grotesque = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-grotesque",
  display: "swap",
});

const serifEditorial = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif-editorial",
  display: "swap",
});

const monoData = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: BRAND,
  description: "A closet measured to the millimetre.",
  /**
   * iOS Safari auto-links anything resembling a phone number, date or
   * address, rewriting the DOM before React hydrates. This app is nothing
   * but numbers ("4 PX/MM · 3476×3334", "800 × 1000 mm"), so on a phone
   * that rewrite is near certain, and it surfaces as a hydration error.
   */
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${grotesque.variable} ${serifEditorial.variable} ${monoData.variable} bg-bg text-fg`}
      >
        <ActivityProvider>
          <Nav />
          <main className="px-gutter pt-(--header-h) pb-(--main-pb)">
            {children}
          </main>
        </ActivityProvider>
      </body>
    </html>
  );
}
