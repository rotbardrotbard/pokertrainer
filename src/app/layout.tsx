import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500"],
});

// Базовый путь для GitHub Pages (/pokertrainer). PNG-иконки лежат в public/icons/
// (файлы icon.png/apple-icon.png в src/app/ ломают сборку Turbopack в Next 16.1.1),
// поэтому ссылки прописываем явно и учитываем basePath вручную.
const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Suited — бесплатная тренировка покерных навыков",
  description:
    "Suited — бесплатный тренажёр Texas Hold'em и Омахи: симулятор раздач, математика и пот-оддсы, аутсы и эквити, EV, теория покера, Омаха с двумя досками (4-card и 5-card), диапазоны префлоп и калькулятор эквити. Без регистрации и подписок.",
  keywords: ["покер", "тренажёр", "Suited", "Texas Holdem", "Омаха", "Omaha", "PLO", "эквити", "аутсы", "пот-оддсы", "GTO", "диапазоны"],
  icons: {
    icon: [
      { url: `${bp}/icons/icon-192.png?v=2`, sizes: "192x192", type: "image/png" },
      { url: `${bp}/icons/icon-512.png?v=2`, sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: `${bp}/icons/apple-touch-icon.png?v=2`, sizes: "180x180", type: "image/png" },
    ],
  },
  // iOS «На экран „Домой“»: запуск без панели браузера (standalone).
  // Next 16 эмитит только новое имя meta (mobile-web-app-capable),
  // дублируем легаси-имя для совместимости со старыми iOS.
  appleWebApp: {
    capable: true,
    title: "Suited",
    statusBarStyle: "black",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#15171b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${cormorant.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
