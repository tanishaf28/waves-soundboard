# 🌊 Waves Ambient Mixer

**Blend your own nature sounds at home.**

No samples. No downloads. No 10-hour "rain sounds" YouTube video with an ad every 4 minutes. Just you, your browser, and ten procedurally synthesized ambient sounds you can stack however you like.

---

## 🎛️ What is this?

Waves is a tiny, single-page ambient soundboard. Tap sounds on and off, layer them together, and let the Web Audio API do the rest every tone, hiss, crackle, and chirp is generated live in-browser. There isn't a single `.mp3` or `.wav` file anywhere in this repo.

Turn on 🌊 Ocean and 🌬️ Wind together and watch the animated wave horizon at the bottom of the screen swell and pick up speed. It's a soundboard that visually reacts to itself.

## 🔊 The pads

| | Sound | Vibe |
|---|---|---|
| 🌊 | Ocean | Slow filtered swells, rolling in and out |
| 🌧️ | Rain | Soft body + gentle droplet taps |
| 🌬️ | Wind | Gusting low-pass sweeps |
| 🍃 | Soft Breeze | Light filtered air with the occasional wind-chime twinkle |
| 🔥 | Campfire | Warm roar with crackle and pop |
| 🌳 | Trees | Slow canopy sway, leaves rustling |
| 🐦 | Birds | Randomized little tweet-tweet phrases |
| 🦗 | Crickets | Rhythmic trilling |
| 🎐 | Wind Chimes | Inharmonic metallic rings, clustered like a real gust catching them |
| 🥁 | Conga Drums | A steady hand-drum pattern, because why not |

Mix any combination there's a shared dynamics compressor under the hood so stacking sounds doesn't clip or crackle at the output.

## ✨ How it works

- **Zero audio assets.** Every sound is built from a shared white-noise buffer and/or oscillators, shaped with biquad filters, LFOs, envelopes, and randomized event schedulers.
- **Procedural visuals.** The wave horizon is drawn as SVG paths generated in JS  three parallax layers, no images.
- **Reactive glow.** Each active pad casts its own colored glow, positioned live under its button.
- **Pyramid layout.** Pads arrange themselves into rows of 1 → 2 → 3 → 4.

Fonts: [Baloo 2](https://fonts.google.com/specimen/Baloo+2) for the big rounded title, [Quicksand](https://fonts.google.com/specimen/Quicksand) for the subtitle.

## 🚀 Running it

There's no build step, no dependencies, no `npm install`. It's just three files.

```bash
git clone https://github.com/tanishaf28/waves-soundboard.git
cd waves-soundboard
open index.html   # or just double-click it
```

Or serve it locally if your browser is picky about local scripts:

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

## 🗂️ Project structure

```
waves-soundboard/
├── index.html   # markup + the wave-row / glow-layer / grid containers
├── style.css    # ocean gradient, wave animation, pad + glow styling
└── script.js    # all the sound synthesis + UI wiring lives here
```

## 🛠️ Built with

Vanilla JS, the Web Audio API, inline SVG, and a healthy amount of `Math.random()`.

## 🌤️ Ideas for later

- More sounds (thunder? owls? a purring cat?)
- Save/share favorite mixes via a URL
- A master volume fader
- Light/dark or time-of-day themes

---

Made for anyone who wants a beach in their bedroom. 🐚
