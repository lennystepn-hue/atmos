# Atmos

Five living looks for Claude Code on desktop.

Each one is a mod: a full color theme for light and dark mode, an animated scene behind the conversation, and one idea that makes the scene mean something. The backdrop isn't wallpaper. It reads the session and shows it to you.

| Look | The scene | What it shows you |
| --- | --- | --- |
| **Abyss** | Open ocean, from sunlit shallows down to the hadal trench | How full your context window is. The fuller it gets, the deeper and darker the water. `/compact` brings you back up. |
| **Forge** | A smithy fire with an anvil in the corner | Your momentum. Every prompt feeds the fire; leave it alone and it burns down to embers, then goes cold. |
| **Horizon** | A mountain sky that keeps your local time | What time it is. Dawn, noon, dusk, then stars and northern lights, with a break reminder and a wrap-up time. |
| **Arcade** | A neon grid running to a striped sun | The score. Tool calls score, clean runs build a combo, every turn is a stage, and the hi-score survives the session. |
| **Ensō** | An ink-wash garden with bamboo and falling petals | A focus timer. `/enso 25` and a brush circle paints itself over 25 minutes. When it closes, you're done. |

Every scene also reacts to Claude: it comes alive while a turn runs and plays a short flourish when the turn ends (a whale passes, steam rises off the quenched blade, a shooting star, `STAGE 07 CLEAR`, a seal is stamped).

## Install

You need Claude Code v2.1.324 or later in the desktop app's Code tab. The terminal draws no backdrop, so there the looks only show their row above the prompt.

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `lennystepn-hue/atmos`, then add the looks you want.

From a terminal session:

```
/plugin install abyss --marketplace lennystepn-hue/atmos
```

From a shell:

```
claude plugin install abyss --marketplace lennystepn-hue/atmos
```

Replace `abyss` with `forge`, `horizon`, `arcade` or `enso`. Start a new session after installing.

## Switch between looks

Install as many as you like. One look stands at a time, and each has a command named after it:

```
/abyss
/forge
/horizon
/arcade
/enso
```

Typing one switches to it right away, mid-session. The others step back by themselves: their rows above the prompt disappear and they stay off in later sessions until you call them again.

## The dials

Every look takes the same words after its command:

| Command | What it does |
| --- | --- |
| `/abyss` | Switch to this look |
| `/abyss off` | Back to the app's own look |
| `/abyss glass 40` | How opaque the app's panels are over the scene, 0 to 100. Lower shows more of the scene. Add a blur from 0 to 64: `/abyss glass 40 4` |
| `/abyss calm` | Hold the scene still: it stops reacting to Claude. `/abyss live` turns that back on |
| `/abyss dark` | Always draw the night scene. `light` for the day scene, `auto` to follow the app |
| `/abyss help` | Everything this look can do |

And each look has a few of its own:

| Look | Commands |
| --- | --- |
| Abyss | `/abyss depth` says how deep the session is. A **Surface** button appears above the prompt once the context window is more than half full. |
| Forge | `/forge stoke` works the bellows by hand. `/forge fire` says how the fire is doing and how long your longest burn was. |
| Horizon | `/horizon breaks 90` reminds you every 90 minutes (`breaks off` for none). `/horizon bedtime 23:30` nudges you to wrap up. `/horizon offset 2` if the machine's clock isn't yours. |
| Arcade | `/arcade score` shows the board. `/arcade reset` wipes the hi-score. |
| Ensō | `/enso 25` begins a sitting of 25 minutes (1 to 240). `/enso stop` ends it early. |

## How it works

A mod can put one SVG behind the conversation, and that SVG runs no script. So each scene is a pure function: the mod keeps a small piece of state (how deep, how hot, what hour, which stage, how far into the sitting), and whenever that state changes it draws the whole scene again as a new SVG string.

Two details keep that from looking like a slideshow:

- **The loops are synced to the clock.** Every animation starts as far in as the day is old, so a scene that is drawn again picks up exactly where the last one was. Nothing jumps when the state changes.
- **Changes fade.** The layer that is only there while Claude works fades in when a turn starts and fades out in the scene drawn when it ends.

Everything is drawn by hand in code: no images, no fonts, no network. The largest scene is about 57 KB.

Each mod is self-contained. The files they share (`kit.ts`, `make-colors.js`) live in `shared/` and are copied into every mod, so any one of them installs alone.

## Develop

```
npm install
npm run preview     # draws every scene in every state to preview/ and builds a gallery
node tools/serve.mjs  # serves the gallery on http://localhost:4173
npm run palettes    # checks every look's colors against the design system's contrast rules
npm run sync        # copies shared/ into each mod after you change it
```

Each mod has tests that run against the engine itself:

```
claude plugin validate mods/abyss
claude plugin test mods/abyss
```

To try a look from this folder without installing it:

```
claude --plugin-dir mods/abyss
```

## License

MIT
