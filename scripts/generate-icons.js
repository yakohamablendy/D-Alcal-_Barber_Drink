const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const outDir = path.join(__dirname, "..", "public", "icons");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function makeSvg(size, maskable = false) {
  const pad = maskable ? size * 0.1 : 0;
  const inner = size - pad * 2;
  const cx = size / 2;
  const cy = size / 2;
  const fontSize = Math.round(inner * 0.32);
  const subSize = Math.round(inner * 0.13);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#0c0c0c" rx="${maskable ? 0 : size * 0.18}"/>
  <text x="${cx}" y="${cy + fontSize * 0.1}" text-anchor="middle" dominant-baseline="central" fill="#ffffff" font-family="Georgia, serif" font-size="${fontSize}" font-weight="400" letter-spacing="-1">B<tspan fill="#c9a84c" font-style="italic" font-size="${Math.round(fontSize * 0.85)}">P</tspan></text>
  <text x="${cx}" y="${cy + fontSize * 0.65}" text-anchor="middle" dominant-baseline="central" fill="#c9a84c" font-family="Georgia, serif" font-size="${subSize}" font-style="italic" letter-spacing="1">Pro</text>
</svg>`;
}

async function main() {
  const configs = [
    { name: "icon-192", size: 192, maskable: false },
    { name: "icon-512", size: 512, maskable: false },
    { name: "icon-maskable-192", size: 192, maskable: true },
    { name: "icon-maskable-512", size: 512, maskable: true },
  ];

  for (const c of configs) {
    const svg = Buffer.from(makeSvg(c.size, c.maskable));
    await sharp(svg).png().toFile(path.join(outDir, `${c.name}.png`));
    console.log(`Created ${c.name}.png`);
  }

  // Also generate apple-touch-icon (180x180)
  const appleSvg = Buffer.from(makeSvg(180, true));
  await sharp(appleSvg).png().toFile(path.join(outDir, "apple-touch-icon.png"));
  console.log("Created apple-touch-icon.png");
}

main().catch(console.error);
