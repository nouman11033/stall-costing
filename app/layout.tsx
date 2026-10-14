import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import ThemeToggle from "@/components/ThemeToggle";

/** Webfont for hosted/Vercel; local Mac still prefers Avenir when installed. */
const appSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cost Estimation - AI Generation APIs",
  description:
    "Calculate monthly Image + 3D generation API combinations with LLM and infrastructure costs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={appSans.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ThemeToggle />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
