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

export const metadata: Metadata = {
  title: "Suited — бесплатная тренировка покерных навыков",
  description:
    "Suited — бесплатный тренажёр Texas Hold'em и Омахи: симулятор раздач, математика и пот-оддсы, аутсы и эквити, EV, теория покера, Омаха с двумя досками (4-card и 5-card), диапазоны префлоп и калькулятор эквити. Без регистрации и подписок.",
  keywords: ["покер", "тренажёр", "Suited", "Texas Holdem", "Омаха", "Omaha", "PLO", "эквити", "аутсы", "пот-оддсы", "GTO", "диапазоны"],
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
