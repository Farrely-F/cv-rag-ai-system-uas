import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google"; // Cyber-Industrial font choice
import { Providers } from "./providers";
import "./globals.css";

const fontSans = Space_Grotesk({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CV-RAG AI System",
  description: "Secure Budget Analysis & Verification",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${fontSans.variable} ${fontMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
