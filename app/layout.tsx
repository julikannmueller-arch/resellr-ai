import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "800"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "Resellr AI — Dein Vinted Toolkit",
  description:
    "KI Try-On & Listings für Vinted Reseller. Foto hochladen, Model wählen, Listing generieren.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={manrope.variable}>
      <body className="font-sans bg-bg text-text-primary antialiased">
        <ClerkProvider>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
