import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Kamu bisa menyesuaikan metadata ini
export const metadata: Metadata = {
  title: "Nechat | App Chat Usagi",
  description: "Web Chat P2P dengan E2EE",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Menggunakan template literal (`) untuk menggabungkan class dan variabel font
      className={`h-full antialiased ${geistSans.variable} ${geistMono.variable} ${inter.variable} font-sans`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}