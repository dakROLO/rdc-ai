import { mkdir, copyFile } from 'node:fs/promises'
const target = new URL('../public/ocr/', import.meta.url)
await mkdir(target, { recursive: true })
await copyFile(new URL('../node_modules/tesseract.js/dist/worker.min.js', import.meta.url), new URL('worker.min.js', target))
for (const variant of ['', '-simd', '-lstm', '-simd-lstm']) {
  for (const extension of ['wasm.js', 'wasm']) {
    const name = `tesseract-core${variant}.${extension}`
    await copyFile(new URL(`../node_modules/tesseract.js-core/${name}`, import.meta.url), new URL(name, target))
  }
}
