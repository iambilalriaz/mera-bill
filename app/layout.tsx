import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter for its tabular figures: this app is mostly numbers that change in place —
 * readings, unit counts, rupee ranges — and proportional digits make them jitter.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const APP_NAME = "Mera Bill";
const TAGLINE = "Electricity Bill & Unit Tracker for Pakistan";

const DESCRIPTION =
  "Fetch your electricity bill from any Pakistani DISCO, read your meter from a photo, " +
  "and track the units you have used since your last bill. Mera Bill estimates what your " +
  "next bill will cost using official NEPRA tariff rates.";

/**
 * Absolute URLs are required for Open Graph — a crawler cannot resolve "/og-image.png".
 * Set NEXT_PUBLIC_SITE_URL in the deployed environment; localhost is only a
 * development fallback so the tags stay well-formed either way.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${APP_NAME} — ${TAGLINE}`,
    // Sub-pages set their own title and get the brand appended.
    template: `%s · ${APP_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  keywords: [
    "electricity bill",
    "bijli bill",
    "unit tracker",
    "meter reading",
    "bijli bill calculator",
    "estimated bill Pakistan",
    "electricity units calculator",
    "MEPCO bill",
    "LESCO bill",
    "FESCO bill",
    "PESCO bill",
    "IESCO bill",
    "GEPCO bill",
    "DISCO bill check",
    "NEPRA tariff",
  ],
  authors: [{ name: APP_NAME }],
  category: "utilities",
  /**
   * Declared rather than left to the app/icon.* file convention: that convention
   * emits a tag for only one of the files, so the SVG was being served and never
   * referenced. PNG first as the universal fallback, SVG second — browsers that
   * understand it prefer the later, scalable one, which stays crisp in bookmark
   * bars and on high-DPI screens where a 32px bitmap goes soft.
   */
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_PK",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — track your electricity units and estimate your next bill`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — ${TAGLINE}`,
    description: DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b111c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
