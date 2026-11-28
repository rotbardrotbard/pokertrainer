// Генерация PNG-иконок для iOS «На экран „Домой“», фавикон-фолбэка и манифеста.
// Запуск: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());

// Полноширинный вариант: iOS/Android сами накладывают маску скругления,
// поэтому фон должен заливать весь квадрат, без прозрачных углов.
// Контент карточек чуть уменьшен (0.9) — безопасная зона под маску.
const fullBleed = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <rect width="64" height="64" fill="#1e2126"/>
  <g transform="translate(32 32) scale(0.9) translate(-32 -32)">
    <g transform="rotate(-8 25 26)">
      <rect x="13" y="9" width="24" height="34" rx="4" fill="#33383f" stroke="#565b63" stroke-width="1"/>
      <path d="M25 18.5 c-2.2 -3 -6.6 -2.4 -6.6 1.5 c0 2.6 3.2 5.2 6.6 8.1 c3.4 -2.9 6.6 -5.5 6.6 -8.1 c0 -3.9 -4.4 -4.5 -6.6 -1.5 z" fill="#9ba1a9"/>
    </g>
    <rect x="27" y="20" width="25" height="36" rx="4" fill="#f5f5f4" stroke="#d6d3d1" stroke-width="1"/>
    <path d="M39.5 31.5 c-2.4 -3.3 -7.3 -2.6 -7.3 1.6 c0 2.9 3.5 5.7 7.3 9 c3.8 -3.3 7.3 -6.1 7.3 -9 c0 -4.2 -4.9 -4.9 -7.3 -1.6 z" fill="#dc2626"/>
  </g>
</svg>`;

const targets = [
  { file: "src/app/apple-icon.png", size: 180 },           // iOS: экран «Домой»
  { file: "src/app/icon.png", size: 96 },                  // фавикон-фолбэк (Safari и др.)
  { file: "public/icons/icon-192.png", size: 192 },        // Android/PWA манифест
  { file: "public/icons/icon-512.png", size: 512 },        // Android/PWA манифест
];

mkdirSync(path.join(ROOT, "public/icons"), { recursive: true });

for (const t of targets) {
  const density = Math.ceil((72 * t.size) / 64);
  await sharp(Buffer.from(fullBleed(t.size)), { density })
    .resize(t.size, t.size)
    .png()
    .toFile(path.join(ROOT, t.file));
  console.log(`OK ${t.file} ${t.size}x${t.size}`);
}
