import { useEffect, useRef } from 'react'
import type { Player } from './lib/player'

const FIRST = 21
const LAST = 108
const BLACK = new Set([1, 3, 6, 8, 10])
const isBlack = (m: number) => BLACK.has(m % 12)
const WHITE_COUNT = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i).filter((m) => !isBlack(m)).length

export const RIGHT_COLOR = '#3fcf8e'
export const LEFT_COLOR = '#4f8cff'

/** Seconds of upcoming music visible above the keyboard. */
const LOOKAHEAD = 3

function keyRect(midi: number, whiteW: number) {
  let whites = 0
  for (let m = FIRST; m < midi; m++) if (!isBlack(m)) whites++
  if (!isBlack(midi)) return { x: whites * whiteW, w: whiteW }
  const w = whiteW * 0.6
  return { x: whites * whiteW - w / 2, w }
}

interface Props {
  player: Player
  split: number
  colorHands: boolean
}

export function PianoRoll({ player, split, colorHands }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef({ split, colorHands })
  propsRef.current = { split, colorHands }

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const W = canvas.clientWidth
      const H = canvas.clientHeight
      if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
        canvas.width = W * dpr
        canvas.height = H * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const { split, colorHands } = propsRef.current
      const color = (pitch: number) => (!colorHands || pitch >= split ? RIGHT_COLOR : LEFT_COLOR)
      const whiteW = W / WHITE_COUNT
      const keyH = Math.min(H * 0.25, whiteW * 5.5)
      const hitY = H - keyH
      const pps = hitY / LOOKAHEAD
      const t = player.time()
      const active = new Map<number, string>()

      ctx.fillStyle = '#0e0f13'
      ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let m = FIRST; m <= LAST; m++) {
        if (m % 12 === 0 || m % 12 === 5) {
          const { x } = keyRect(m, whiteW)
          ctx.beginPath()
          ctx.moveTo(x + 0.5, 0)
          ctx.lineTo(x + 0.5, hitY)
          ctx.stroke()
        }
      }

      if (player.loop) {
        const yA = hitY - (player.loop.a - t) * pps
        const yB = hitY - (player.loop.b - t) * pps
        ctx.fillStyle = 'rgba(243,193,91,0.06)'
        ctx.fillRect(0, Math.max(0, yB), W, Math.min(hitY, yA) - Math.max(0, yB))
      }

      for (const n of player.notes) {
        if (n.start > t + LOOKAHEAD) break
        if (n.start + n.duration < t) continue
        const pitch = n.pitch + player.transpose
        if (pitch < FIRST || pitch > LAST) continue
        const c = color(n.pitch)
        if (n.start <= t) active.set(pitch, c)
        const { x, w } = keyRect(pitch, whiteW)
        const bottom = hitY - (n.start - t) * pps
        const top = hitY - (n.start + n.duration - t) * pps
        ctx.globalAlpha = 0.5 + n.velocity * 0.5
        ctx.fillStyle = c
        roundRect(ctx, x + 1, top, w - 2, Math.min(bottom, hitY) - top, Math.min(4, w / 3))
        ctx.globalAlpha = 1
      }

      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fillRect(0, hitY - 2, W, 2)

      for (let m = FIRST; m <= LAST; m++) {
        if (isBlack(m)) continue
        const { x, w } = keyRect(m, whiteW)
        ctx.fillStyle = active.get(m) ?? '#f4f4f4'
        ctx.fillRect(x, hitY, w - 1, keyH)
      }
      for (let m = FIRST; m <= LAST; m++) {
        if (!isBlack(m)) continue
        const { x, w } = keyRect(m, whiteW)
        ctx.fillStyle = active.get(m) ?? '#15161a'
        ctx.fillRect(x, hitY, w, keyH * 0.62)
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [player])

  return <canvas ref={canvasRef} className="roll" />
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, h / 2))
  ctx.fill()
}
