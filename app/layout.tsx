import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echo Breaker - Playtest",
  description: "An endless combo brick breaker with continuously descending rows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
