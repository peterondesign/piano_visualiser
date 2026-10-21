import { readFileSync, mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Replicate from 'replicate'
import { PNG } from 'pngjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'hands')
mkdirSync(outDir, { recursive: true })

const env = readFileSync(join(root, '.env'), 'utf8')
const token = env.match(/REPLICATE_API_TOKEN=(.+)/)?.[1]?.trim()
if (!token) throw new Error('REPLICATE_API_TOKEN missing')

const replicate = new Replicate({ auth: token })
const force = process.argv.includes('--force')
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7)
const onlySet = only ? new Set(only.split(',').map(Number)) : null

const poses = [
  'ONLY one index finger, close-up. No other fingers, no palm, no wrist. The fingertip is flush with the top edge. The finger fills the frame width.',
  'ONLY one middle finger, close-up. No other fingers, no palm. Fingertip flush with the top edge, finger fills the frame.',
  'ONLY one thumb, close-up. No other fingers. Fingertip flush with the top edge.',
  'Exactly TWO fingers: index and middle, close together. No other fingers. Both fingertips flush with the top edge. They fill the frame width.',
  'Exactly TWO fingers: thumb and index. Both fingertips flush with the top edge.',
  'Exactly TWO fingers: thumb and pinky stretched to opposite corners. Fingertips touch the top-left and top-right. A wide reach.',
  'Exactly THREE fingers in a triad: thumb, index, middle. All fingertips on the top edge. Outer fingers touch the left and right edges.',
  'Exactly THREE fingers, slightly spread. Fingertips on the top edge, filling the width.',
  'Exactly THREE fingers, wider span. Outer fingertips in the top corners.',
  'Exactly THREE fingers, compact cluster. Fingertips on the top edge.',
  'Exactly FOUR fingers. Fingertips on the top edge. Outer fingers on the left and right edges.',
  'Exactly FOUR fingers, comfortable spread. Fingertips on the top edge.',
  'Exactly FOUR fingers, pinky extended. Fingertips on the top edge.',
  'ALL FIVE fingers spread so the thumb and pinky touch the left and right edges. Every fingertip is on the top edge. Wrist on the bottom edge. The hand fills the entire frame, no empty margin.',
  'ALL FIVE fingers, natural piano curve. Thumb and pinky on the side edges, fingertips on the top edge, wrist on the bottom edge. Fills the frame.',
  'ALL FIVE fingers, extra-wide reach. Thumb and pinky in the top corners. Wrist on the bottom edge. Fills the frame.',
]

function prompt(hand, pose) {
  const side = hand === 'lh' ? 'left' : 'right'
  const thumb = hand === 'lh' ? 'On a left hand the thumb is on the right.' : 'On a right hand the thumb is on the left.'
  return `Technical ink sketch of a pianist's ${side} hand, top-down, back of the hand toward the camera. ${thumb} ${pose} Fingers point straight up and MUST reach the top edge of the image so they can land on piano keys. Thin black outline only, no fill, no shading, no piano, no keys, no text, no color. Plain white background.`
}

function asUrl(output) {
  if (typeof output === 'string') return output
  if (Array.isArray(output)) return asUrl(output[0])
  if (output && typeof output === 'object' && 'url' in output) {
    const value = output.url()
    return typeof value === 'string' ? value : value.href
  }
  return ''
}

function clearWhite(buffer) {
  const png = PNG.sync.read(buffer)
  const { data, width, height } = png
  const seen = new Uint8Array(width * height)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = y * width + x
    if (seen[i]) return
    const p = i * 4
    if (data[p] < 236 || data[p + 1] < 236 || data[p + 2] < 236) return
    seen[i] = 1
    data[p + 3] = 0
    stack.push(x, y)
  }
  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }
  while (stack.length) {
    const y = stack.pop()
    const x = stack.pop()
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3]
      if (a < 24) continue
      data[(y * width + x) * 4] = 18
      data[(y * width + x) * 4 + 1] = 18
      data[(y * width + x) * 4 + 2] = 18
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (maxX < minX) return PNG.sync.write(png)
  const padX = Math.round((maxX - minX) * 0.04)
  minX = Math.max(0, minX - padX)
  maxX = Math.min(width - 1, maxX + padX)
  maxY = Math.min(height - 1, maxY + Math.round((maxY - minY) * 0.03))
  const w = maxX - minX + 1
  const h = maxY - minY + 1
  const out = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const from = ((minY + y) * width + (minX + x)) * 4
      const to = (y * w + x) * 4
      out.data[to] = data[from]
      out.data[to + 1] = data[from + 1]
      out.data[to + 2] = data[from + 2]
      out.data[to + 3] = data[from + 3]
    }
  }
  return PNG.sync.write(out)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function one(hand, index) {
  const file = join(outDir, `${hand}-${String(index).padStart(2, '0')}.png`)
  if (existsSync(file) && !force) return
  if (existsSync(file) && force) unlinkSync(file)
  let output
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      output = await replicate.run('google/nano-banana-2.1', {
        input: {
          prompt: prompt(hand, poses[index - 1]),
          aspect_ratio: '3:4',
          resolution: '1K',
          output_format: 'png',
        },
      })
      break
    } catch (error) {
      if (!String(error).includes('429') || attempt === 5) throw error
      await sleep(12000 * (attempt + 1))
    }
  }
  const url = asUrl(output)
  const response = await fetch(url)
  const raw = Buffer.from(await response.arrayBuffer())
  writeFileSync(file, clearWhite(raw))
  console.log('saved', file)
  await sleep(11000)
}

const jobs = []
for (const hand of ['lh', 'rh']) {
  for (let index = 1; index <= 16; index++) {
    if (onlySet && !onlySet.has(index)) continue
    jobs.push([hand, index])
  }
}

for (const [hand, index] of jobs) await one(hand, index)
console.log('done')
