import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core Breaker - Playtest",
  description: "A 20-wave brick breaker with fixed patterns, 60-second rounds, and core defense.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
