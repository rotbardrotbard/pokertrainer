import type { MetadataRoute } from "next";

// Для GitHub Pages (проектный сайт) иконки и стартовый URL
// должны учитывать базовый путь /pokertrainer.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const root = basePath ? `${basePath}/` : "/";

// Требуется для статического экспорта (output: "export").
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Suited — бесплатная тренировка покерных навыков",
    short_name: "Suited",
    description:
      "Бесплатный тренажёр Texas Hold'em и Омахи: симуляторы раздач, математика, аутсы и эквити, EV, теория, диапазоны. Без регистрации и подписок.",
    start_url: root,
    scope: root,
    display: "standalone",
    orientation: "portrait",
    background_color: "#15171b",
    theme_color: "#15171b",
    lang: "ru",
    icons: [
      {
        src: `${basePath}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
