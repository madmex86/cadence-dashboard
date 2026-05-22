import { Lora, Caveat } from "next/font/google";
import "./globals.css";

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
});

export const metadata = {
  title: "Cadence Dashboard",
  description: "Next.js dashboard for Cadence Creatures",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${lora.variable} ${caveat.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
