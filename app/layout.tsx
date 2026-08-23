import type { Metadata } from "next";
import { DM_Mono, Manrope, Newsreader } from "next/font/google";
import "../styles.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" });
const dmMono = DM_Mono({ weight: ["300", "400", "500"], subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = { title: "TCF Atelier", description: "Focused French exam practice for the TCF." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${manrope.variable} ${newsreader.variable} ${dmMono.variable}`}>{children}</body></html>;
}
