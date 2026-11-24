import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "cyrillic"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  title: "Покер Тренажёр — бесплатная тренировка покерных навыков",
  description:
    "Бесплатный тренажёр Texas Hold'em: симулятор раздач, математика и пот-оддсы, аутсы и эквити, EV, определение победителя, диапазоны префлоп и калькулятор эквити. Без регистрации и подписок.",
  keywords: ["покер", "тренажёр", "Texas Holdem", "эквити", "аутсы", "пот-оддсы", "GTO", "диапазоны"],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>♠</text></svg>",
  },
};

export const viewport: Viewport = {
  themeColor: "#081511",
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
        className={`${inter.variable} ${playfair.variable} font-sans antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
