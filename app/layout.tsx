import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { SyncWatcher } from "@/components/SyncWatcher";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "مفاضلتي",
  description: "الاختصاصات المتاحة وقائمة الرغبات المشتركة للمفاضلة الجامعية",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. RTL helpers) add attributes to <html> before hydration.
    <html lang="ar" dir="rtl" className={`${arabic.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <SyncWatcher />
        <Toaster />
      </body>
    </html>
  );
}
