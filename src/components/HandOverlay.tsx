import { placeHands, handImage, WHITE_KEY_WIDTH, type HandPlacement } from '../lib/hands'

function box(placement: HandPlacement) {
  const xs = placement.anchors.map((anchor) => anchor.x)
  const min = Math.min(...xs)
  const max = Math.max(...xs)
  const center = (min + max) / 2
  const n = placement.anchors.length
  const white = WHITE_KEY_WIDTH

  let width = white
  if (n === 1) width = white * 1.35
  else if (n === 2) width = Math.max(max - min + white * 1.4, white * 3.2)
  else if (n === 3) width = Math.max(max - min + white * 1.6, white * 4.6)
  else if (n === 4) width = Math.max(max - min + white * 1.8, white * 6)
  else width = Math.max(max - min + white * 2, white * 7.4)

  let left = center - width / 2
  if (left < 0) left = 0
  if (left + width > 1) left = Math.max(0, 1 - width)
  return { left, width, n }
}

export function HandOverlay({ notes }: { notes: number[] }) {
  const placements = placeHands(notes)
  if (placements.length === 0) return null

  return (
    <div className="hands" aria-hidden>
      {placements.map((placement) => {
        const { left, width, n } = box(placement)
        return (
          <div
            key={placement.hand}
            className={`hand-wrap n${n}`}
            style={{ left: `${left * 100}%`, width: `${width * 100}%` }}
          >
            <img className="hand-img" alt="" src={handImage(placement.hand, placement.pose)} />
          </div>
        )
      })}
    </div>
  )
}
