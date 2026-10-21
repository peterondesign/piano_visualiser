import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'hands')

function trim(buffer) {
  const src = PNG.sync.read(buffer)
  const { width, height, data } = src
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3]
      if (a < 24) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX) return buffer
  const padX = Math.round((maxX - minX) * 0.04)
  const padY = Math.round((maxY - minY) * 0.03)
  minX = Math.max(0, minX - padX)
  minY = Math.max(0, minY)
  maxX = Math.min(width - 1, maxX + padX)
  maxY = Math.min(height - 1, maxY + padY)
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const out = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const from = ((minY + y) * width + (minX + x)) * 4
      const to = (y * w + x) * 4
      const alpha = data[from + 3]
      out.data[to] = 18
      out.data[to + 1] = 18
      out.data[to + 2] = 18
      out.data[to + 3] = alpha
    }
  }
  return PNG.sync.write(out)
}

for (const name of readdirSync(dir).filter((file) => file.endsWith('.png'))) {
  const path = join(dir, name)
  writeFileSync(path, trim(readFileSync(path)))
  console.log('trimmed', name)
}
