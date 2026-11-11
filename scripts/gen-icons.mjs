// Renders the PWA icon PNGs from the app icon artwork. Run: npm run icons
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')

const iconSvg = await readFile(join(pub, 'icon.svg'))

// Maskable variant: art shrunk into the 80% safe zone on a full-bleed background.
const maskableSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#6366f1"/>
  <g transform="translate(8.32 8.32) scale(0.74)">
    <rect x="15" y="24" width="26" height="18" rx="3" fill="#ffffff" opacity="0.35" transform="rotate(-8 28 33)"/>
    <rect x="20" y="22" width="26" height="18" rx="3" fill="#ffffff" opacity="0.65" transform="rotate(-2 33 31)"/>
    <rect x="24" y="21" width="26" height="18" rx="3" fill="#ffffff" transform="rotate(5 37 30)"/>
    <circle cx="49" cy="17" r="4" fill="#fbbf24"/>
  </g>
</svg>`)

await sharp(iconSvg, { density: 384 }).resize(192, 192).png().toFile(join(pub, 'pwa-192.png'))
await sharp(iconSvg, { density: 384 }).resize(512, 512).png().toFile(join(pub, 'pwa-512.png'))
await sharp(maskableSvg, { density: 384 }).resize(512, 512).png().toFile(join(pub, 'pwa-maskable-512.png'))
console.log('icons written to public/')
