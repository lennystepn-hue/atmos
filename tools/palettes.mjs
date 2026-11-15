// Checks every look's palette against the design system's own rules.
let bad = 0
for (const name of ['abyss', 'forge', 'horizon', 'arcade', 'enso']) {
  try {
    const { problems } = await import(`../mods/${name}/hooks/palette.js`)
    const fatal = problems.filter(l => l.startsWith("Desktop won't paint"))
    console.log(`\n== ${name}: ${problems.length} notes, ${fatal.length} fatal`)
    for (const l of problems) console.log('  ' + l)
    bad += fatal.length
  } catch (err) {
    bad += 1
    console.log(`\n== ${name}: THROWS ${err.message}`)
  }
}
process.exit(bad ? 1 : 0)
