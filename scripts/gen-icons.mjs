// Генерация иконок Suited: минималистичный дизайн «чёрный фон + золотая пика».
// Запуск: node scripts/gen-icons.mjs
//  - src/app/icon.svg            — фавикон (скруглённый квадрат, для вкладки браузера)
//  - public/icons/*.png          — apple-touch-icon 180, манифест 192/512 (полный залив фона:
//                                  iOS/Android сами накладывают маску скругления)
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());

// Пика: перевёрнутое «сердце» + хвост, локальные координаты 0..100.
const SPADE_BODY =
  "M50,70 C50,82 60,92 72,92 C86,92 94,80 94,68 C94,44 74,32 50,8 C26,32 6,44 6,68 C6,80 14,92 28,92 C40,92 50,82 50,70 Z";
const SPADE_STEM =
  "M50,68 C50,82 45,91 33,98 C43,95 47,96 50,96 C53,96 57,95 67,98 C55,91 50,82 50,68 Z";

const DEFS = `
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f7e08e"/>
      <stop offset="0.5" stop-color="#e3bc55"/>
      <stop offset="1" stop-color="#c6952c"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#d4af37" stop-opacity="0.20"/>
      <stop offset="1" stop-color="#d4af37" stop-opacity="0"/>
    </radialGradient>
  </defs>`;

// scale/tx/ty — посадка пики в квадрат; rounded — скруглять ли фон (только для вкладки браузера).
function iconSvg(size, s, tx, ty, rounded) {
  const rx = rounded ? Math.round(size * 0.22) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  ${DEFS}
  <rect width="${size}" height="${size}"${rounded ? ` rx="${rx}"` : ""} fill="#0a0a0c"/>
  <g transform="translate(${tx} ${ty}) scale(${s})">
    <ellipse cx="50" cy="52" rx="46" ry="46" fill="url(#glow)"/>
    <path d="${SPADE_BODY}" fill="url(#gold)"/>
    <path d="${SPADE_STEM}" fill="url(#gold)"/>
  </g>
</svg>`;
}

// Пика занимает ~58% высоты, центр чуть выше геометрического центра квадрата.
// Бокс пики в локальных координатах: y 8..98 (высота 90), центр по y = 53.
function layout(size) {
  const s = (size * 0.58) / 90;
  const tx = size / 2 - s * 50;
  const ty = size / 2 - s * 53;
  return { s, tx, ty };
}

mkdirSync(path.join(ROOT, "public/icons"), { recursive: true });

// SVG-фавикон для вкладки браузера (скруглённый фон).
const fav = layout(64);
writeFileSync(path.join(ROOT, "src/app/icon.svg"), iconSvg(64, fav.s, fav.tx, fav.ty, true));
console.log("OK src/app/icon.svg (64, rounded)");

// PNG: полный залив фона — маску скругления накладывает ОС.
const pngTargets = [
  ["public/icons/apple-touch-icon.png", 180],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
];
for (const [file, size] of pngTargets) {
  const l = layout(size);
  const density = Math.ceil((72 * size) / 64);
  await sharp(Buffer.from(iconSvg(size, l.s, l.tx, l.ty, false)), { density })
    .resize(size, size)
    .png()
    .toFile(path.join(ROOT, file));
  console.log(`OK ${file} ${size}x${size}`);
}
