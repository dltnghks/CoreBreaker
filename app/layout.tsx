import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Core Breaker - Playtest",
  description: "A one-ball, 20-wave brick breaker with fixed patterns and core-loss recovery.",
};

export const dynamic = "force-static";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
