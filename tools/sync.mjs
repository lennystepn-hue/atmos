// Copies the files every mod shares from shared/ into each mod, so each one installs alone.
import { copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

for (const mod of ['abyss', 'forge', 'horizon', 'arcade', 'enso']) {
  for (const file of ['kit.ts', 'make-colors.js', 'make-colors.d.ts']) {
    copyFileSync(join(ROOT, 'shared', file), join(ROOT, 'mods', mod, 'hooks', file))
  }
  console.log('synced ' + mod)
}
