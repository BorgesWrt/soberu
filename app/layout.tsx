import type { Metadata } from "next";
import { Manrope, Playfair_Display } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const manrope = Manrope({ variable: "--font-sans", subsets: ["cyrillic", "latin"] });
const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["cyrillic", "latin"],
  style: ["normal", "italic"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Соберёмся — планировщик встреч в Петербурге";
  const description = "Найдите общее время и получите три готовых плана встречи для всей компании.";

  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: { icon: "/favicon.svg" },
    openGraph: { title, description, images: [{ url: `${origin}/og.png`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body className={`${manrope.variable} ${playfair.variable}`}>{children}</body>
    </html>
  );
}
