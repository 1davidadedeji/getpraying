import type { Metadata } from "next";
import { Noto_Serif, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth";

const serif = Noto_Serif({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Get Praying Admin",
  description: "Admin & Moderator dashboard for Get Praying",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`min-h-[100dvh] antialiased ${serif.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="min-h-[100dvh] bg-[var(--color-cream-muted)] font-sans text-[var(--color-primary)]">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
