import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo Breaker - Playtest",
  description: "A one-minute brick breaker powered by your past plays.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
