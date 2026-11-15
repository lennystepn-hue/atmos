// Draws every look's scene in a handful of states and builds preview/index.html,
// a gallery that shows each one behind a mock of the app's frosted panels.
//
//   npm run preview            every look
//   npm run preview -- abyss   one look

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { build } from 'esbuild'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'preview')
const AT = 43_210.5

// The states worth looking at, per look: [label, view].
const STATES = {
  abyss: [
    ['Sunlight zone · idle', { mood: 'idle', zone: 0, at: AT }],
    ['Twilight zone · Claude working', { mood: 'working', zone: 1, at: AT }],
    ['Midnight zone · turn done', { mood: 'done', zone: 2, at: AT }],
    ['Hadal zone · Claude working', { mood: 'working', zone: 4, at: AT }],
  ],
  forge: [
    ['Cold forge', { mood: 'idle', heat: 0, at: AT }],
    ['Embers', { mood: 'idle', heat: 1, at: AT }],
    ['Burning · Claude working', { mood: 'working', heat: 2, at: AT }],
    ['White-hot · turn done', { mood: 'done', heat: 4, at: AT }],
  ],
  horizon: [
    ['Dawn 06:30', { mood: 'idle', hour: 6.5, at: AT }],
    ['Noon · Claude working', { mood: 'working', hour: 12.5, at: AT }],
    ['Dusk 19:40 · turn done', { mood: 'done', hour: 19.7, at: AT }],
    ['Night 23:30 · Claude working', { mood: 'working', hour: 23.5, at: AT }],
  ],
  arcade: [
    ['Attract mode', { mood: 'idle', stage: 1, combo: 0, at: AT }],
    ['Combo ×6 · Claude working', { mood: 'working', stage: 4, combo: 6, at: AT }],
    ['Stage clear', { mood: 'done', stage: 7, combo: 0, at: AT }],
  ],
  enso: [
    ['Still garden', { mood: 'idle', focus: null, at: AT }],
    ['Focus, 40% painted · Claude working', { mood: 'working', focus: { startedAt: AT - 600, seconds: 1500 }, at: AT }],
    ['Ensō complete · turn done', { mood: 'done', focus: { startedAt: AT - 1500, seconds: 1500 }, at: AT }],
  ],
}

const only = process.argv.slice(2)
const names = Object.keys(STATES).filter(name => (only.length === 0 || only.includes(name)) && existsSync(join(ROOT, 'mods', name, 'hooks', 'scene.ts')))

mkdirSync(join(OUT, 'scenes'), { recursive: true })

async function load(name) {
  const outfile = join(OUT, 'scenes', `.${name}.scene.mjs`)
  await build({
    entryPoints: [join(ROOT, 'mods', name, 'hooks', 'scene.ts')],
    bundle: true,
    format: 'esm',
    outfile,
    logLevel: 'silent',
  })
  const scene = await import(`${pathToFileURL(outfile).href}?${Date.now()}`)
  const palette = await import(pathToFileURL(join(ROOT, 'mods', name, 'hooks', 'palette.js')).href)

  return { scene, definition: palette.DEFINITION }
}

const slug = text => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function windowOf(file, label, anchors, accent, scheme) {
  const panel = anchors['surface-1'] ?? anchors['surface-0']
  const style = [
    `--panel:${panel}`,
    `--page:${anchors['surface-0']}`,
    `--text:${anchors['text-primary']}`,
    `--muted:${anchors['text-muted'] ?? anchors['text-primary']}`,
    `--accent:${accent}`,
  ].join(';')

  return `
    <figure class="shot ${scheme}" style="${style}">
      <div class="window">
        <img src="scenes/${file}" alt="${label}">
        <div class="app">
          <aside class="glass side"><i></i><i></i><i class="on"></i><i></i><i></i></aside>
          <main>
            <div class="glass bubble me">make the hero section pop</div>
            <div class="glass bubble"><b></b><b></b><b class="short"></b><code>edit src/hero.tsx</code><b></b><b class="short"></b></div>
            <div class="glass prompt"><span>Reply…</span><em></em></div>
          </main>
        </div>
      </div>
      <figcaption>${label} <small>${scheme}</small></figcaption>
    </figure>`
}

let sections = ''
let total = 0

for (const name of names) {
  const { scene, definition } = await load(name)
  let shots = ''

  for (const [label, view] of STATES[name]) {
    for (const scheme of ['dark', 'light']) {
      const svg = scene.drawScene(view, scheme)
      const file = `${name}-${slug(label)}-${scheme}.svg`
      writeFileSync(join(OUT, 'scenes', file), svg)
      shots += windowOf(file, label, definition[scheme].gray.anchors, definition.roles.accent, scheme)
      total += 1

      if (svg.length >= 131_072) {
        console.error(`!! ${file} is ${svg.length} characters: over the 131,072 an Svg may hold`)
        process.exitCode = 1
      }
      console.log(`${file}  ${(svg.length / 1024).toFixed(1)} KB`)
    }
  }
  sections += `<section id="${name}"><h2>${definition.label}</h2><div class="grid">${shots}</div></section>`
}

const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atmos · scene preview</title>
<style>
  :root { color-scheme: dark; font: 15px/1.5 ui-sans-serif, system-ui, "Segoe UI", sans-serif; }
  body { margin: 0; padding: 32px 24px 80px; background: #0c0d10; color: #e9eaee; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -.01em; }
  p.lead { margin: 0 0 28px; color: #9a9da8; max-width: 70ch; }
  h2 { font-size: 20px; margin: 44px 0 14px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 560px), 1fr)); gap: 22px; }
  figure { margin: 0; }
  figcaption { margin-top: 8px; color: #b9bcc6; font-size: 13px; }
  figcaption small { color: #6f7380; margin-left: 6px; text-transform: uppercase; letter-spacing: .08em; font-size: 10.5px; }
  .window { position: relative; aspect-ratio: 16 / 10; border-radius: 14px; overflow: hidden; background: var(--page);
    box-shadow: 0 0 0 1px #ffffff14, 0 18px 50px #0009; }
  .window img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  .app { position: absolute; inset: 0; display: grid; grid-template-columns: 22% 1fr; gap: 2.2%; padding: 3%; color: var(--text); font-size: clamp(9px, 1.25vw, 13px); }
  .glass { background: color-mix(in srgb, var(--panel) 56%, transparent); backdrop-filter: blur(9px); -webkit-backdrop-filter: blur(9px);
    border-radius: 10px; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--text) 9%, transparent); }
  .side { display: flex; flex-direction: column; gap: 7%; padding: 14% 12%; }
  .side i { height: 5%; border-radius: 99px; background: color-mix(in srgb, var(--text) 16%, transparent); }
  .side i.on { background: color-mix(in srgb, var(--accent) 70%, transparent); width: 80%; }
  main { display: flex; flex-direction: column; gap: 3.5%; min-width: 0; padding: 0 9%; }
  .bubble { padding: 3% 4%; display: flex; flex-direction: column; gap: .7em; }
  .bubble.me { align-self: flex-end; max-width: 60%; }
  .bubble b { height: .62em; border-radius: 99px; background: color-mix(in srgb, var(--text) 22%, transparent); }
  .bubble b.short { width: 55%; }
  .bubble code { align-self: flex-start; font: inherit; font-family: ui-monospace, Consolas, monospace; color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent); padding: .2em .6em; border-radius: 6px; }
  .prompt { margin-top: auto; padding: 3% 4%; display: flex; justify-content: space-between; align-items: center; color: var(--muted); }
  .prompt em { width: 1.7em; height: 1.7em; border-radius: 50%; background: var(--accent); }
</style>
<h1>Atmos</h1>
<p class="lead">${total} drawings of ${names.length} looks. Each scene is one animated SVG, shown here behind a mock of the app's frosted panels at the default glass (56% opaque, blur 9).</p>
${sections}
</html>
`

writeFileSync(join(OUT, 'index.html'), html)
console.log(`\npreview/index.html: ${total} drawings of ${names.join(', ')}`)

// Every drawing has to be well-formed XML, or a surface draws nothing at all.
// A cheap check that catches the usual slip: one attribute written twice on a tag.
import { readdirSync, readFileSync } from 'node:fs'

for (const file of readdirSync(join(OUT, 'scenes')).filter(name => name.endsWith('.svg'))) {
  const svg = readFileSync(join(OUT, 'scenes', file), 'utf8')

  for (const tag of svg.match(/<[a-zA-Z][^>]*>/g) ?? []) {
    const names = [...tag.matchAll(/\s([a-zA-Z:-]+)=/g)].map(match => match[1])
    const twice = names.find((name, index) => names.indexOf(name) !== index)

    if (twice !== undefined) {
      console.error(`!! ${file}: "${twice}" is written twice in ${tag.slice(0, 90)}`)
      process.exitCode = 1
    }
  }
}
