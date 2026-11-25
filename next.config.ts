import type { NextConfig } from "next";

// Обычная сборка (песочница/сервер): output: "standalone".
// Статический экспорт для GitHub Pages:
//   STATIC_EXPORT=1 bun run build  →  статика в out/
// Для проектного сайта GitHub Pages (https://<user>.github.io/<repo>/)
// укажите NEXT_PUBLIC_BASE_PATH=/<repo> при сборке.
const isStaticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  ...(isStaticExport
    ? {
        output: "export" as const,
        images: { unoptimized: true },
        ...(basePath ? { basePath, assetPrefix: basePath } : {}),
      }
    : {
        output: "standalone",
      }),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
