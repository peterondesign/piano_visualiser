import { readFileSync, writeFileSync } from 'node:fs'
import Replicate from 'replicate'

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)

const replicate = new Replicate({ auth: env.REPLICATE_API_TOKEN })

const prompt = `You are art directing a real-time Three.js piano visualiser.

CURRENT LOOK (problems to fix):
- Empty black void, warehouse HDR, muddy gold UI
- Low-poly African American man in a dark charcoal suit at a black grand piano
- Cream keys, gold pressed glow, purple black-key glow
- Sidebar + floating glass panels in beige/gold
- Character hair reads like a beret; lighting is flat; piano lid swallows the stage

GOAL: a complete cinematic graphics revamp. Jazz-club / concert-hall night. Keep the same character identity (African American man, suit, short hair) but make materials, lighting, stage, and UI feel premium.

Return JSON only, no markdown, with this exact shape:
{
  "theme": "short name",
  "mood": "one sentence",
  "css": {
    "bg": "#hex",
    "panel": "css color",
    "panelSolid": "#hex",
    "line": "css color",
    "accent": "#hex",
    "accent2": "#hex",
    "muted": "#hex",
    "text": "#hex",
    "glow": "#hex",
    "danger": "#hex"
  },
  "scene": {
    "background": "#hex",
    "fog": "#hex",
    "floor": "#hex",
    "hemisphereSky": "#hex",
    "hemisphereGround": "#hex",
    "keyFill": "#hex",
    "rim": "#hex",
    "spot": "#hex",
    "environment": "night|studio|city|warehouse|sunset"
  },
  "piano": {
    "case": "#hex",
    "soundboard": "#hex",
    "white": "#hex",
    "black": "#hex",
    "whitePressed": "#hex",
    "blackPressed": "#hex",
    "whiteEmissive": "#hex",
    "blackEmissive": "#hex",
    "labelLight": "#hex",
    "labelDark": "#hex"
  },
  "character": {
    "skin": "#hex",
    "skinDark": "#hex",
    "suit": "#hex",
    "shirt": "#hex",
    "tie": "#hex",
    "hair": "#hex",
    "shoe": "#hex",
    "outline": "#hex"
  },
  "uiNotes": ["3 short implementation notes"]
}`

const output = await replicate.run('openai/gpt-5.6-sol', {
  input: {
    prompt,
    reasoning_effort: 'medium',
    verbosity: 'low',
    max_completion_tokens: 1200,
  },
})

const text = Array.isArray(output) ? output.join('') : String(output)
writeFileSync('scripts/theme.json', text)
console.log('wrote scripts/theme.json')
console.log(text.slice(0, 2000))
