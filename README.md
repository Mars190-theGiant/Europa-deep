# Abismo de Europa

**English** · [Português](README.pt-BR.md)

An educational space mission design game for NASA Space Apps (challenge **Space Mission Design Game**). You design a mission to the ocean hidden under the ice of Europa, a moon of Jupiter: pick the destination, rocket, trajectory and crew within a limited budget and cargo capacity, build the base and the submarine, and dive to find out whether your design works.

**Play:** <https://mars190-thegiant.github.io/Europa-deep/>

| Page | What it is |
|---|---|
| [`/`](https://mars190-thegiant.github.io/Europa-deep/) | Home page: the problem, a 3D globe of Europa with filters, a simulator of ready-made designs with charts, and a quiz |
| [`/jogo.html`](https://mars190-thegiant.github.io/Europa-deep/jogo.html) | The game (version 2, ported from the Unity v2 project) |
| [`/classico/`](https://mars190-thegiant.github.io/Europa-deep/classico/) | The first version, with a first-person cockpit and a mystery mood (Portuguese only) |

**Languages:** the site and the game open in English. The **EN · PT** button at the top (or `?lang=pt` in the address) switches to Portuguese, and the browser remembers the choice.

The science data are real (NASA, JPL, Hubble, James Webb, Juno, Galileo). The creatures and the people are fiction.

## How to play

1. **Design.** Choose who you are (Luísa Galvão or Téo Junqueira), the destination on the map (4 missions, from easy to hard), the rocket (Atlas V 551, Falcon Heavy, SLS), the trajectory (direct, MEGA, VEEGA) and the crew. The rocket and salaries cost budget; everything has mass on the rocket.
2. **Planning**, between cycles: 8 base modules, 6 submarine upgrades, 8 real Europa Clipper instruments paid with data, 6 power cells to split, and talks with the crew.
3. **Dive:** 12 cycles of 5 turns. Navigate, scan, sonar, electrolysis, repair, descend and ascend between 4 zones, recharge at the hydrothermal vent, call the base, rest, go out on **EVA** with the astronaut (needs the airlock) and dock.
4. **The unexpected:** scenarios are drawn by a **random forest** of 9 decision trees that look at the mission state and vote; the chosen mission pulls the votes toward its themes. Some choices open a second scenario.
5. **The end:** a grade from S to D, a chart of resources over the mission, a reading of what the numbers mean, and the summary “How your choices shaped the mission”.

Keyboard: 1–0, E and A for actions, Enter ends the cycle, D log, M map, S sound. On EVA: WASD or arrows, Space and C, Shift, E. On phones everything is touch, with a joystick on EVA; best in landscape.

## Simulator (home page)

Five ready-made designs run 200 times each, with the same rules as the game (`src/engine.js`) and an autopilot that sometimes makes mistakes (`src/sim.js`). The page shows the success rate, the average resources per cycle, how the missions ended, a comparison between designs, and a written interpretation: what is good, what is risky and what limits each design. The “Play this design” button opens the game with that choice already filled in (`jogo.html?projeto=clipper`).

## How the code is organized

It is not a single HTML file: it uses JavaScript modules, JSON data, Three.js for 3D and HTML/CSS for the 2D interface.

```
index.html          home page               css/site.css   src/landing.js
jogo.html           game                    css/game.css   src/game.js
css/base.css        shared styles
src/engine.js       rules: resources, actions, end of cycle, events, endings, score (ported from the Unity GameManager)
src/forest.js       random forest that picks the scenarios (ported from ScenarioForest.cs)
src/sim.js          ready-made designs, autopilot and interpretation of results
src/i18n.js         language (English default, Portuguese optional), static texts and the en.json merge
src/world3d.js      Three.js scenes: Europa globe with filters, Jupiter, base, buildable sub, ocean by zone, EVA
src/map2d.js        surface map and ice/ocean cross-section in Canvas 2D
src/charts.js       Canvas 2D charts
src/audio.js        soundtrack with crossfade (Web Audio) and generated sound effects
data/*.json         missions, crew, rockets and trajectories, 20 scenarios, zones, targets, events, modules, upgrades, research, texts (Portuguese)
data/en.json        English layer for all the data (merged by id in loadDB)
img/crew/           crew portraits
audio/              original soundtrack (ogg and mp3)
lib/three.min.js    Three.js r128 (MIT)
classico/           the first version of the game
```

The files in `data/` were converted from the Unity project (`DefaultContent.cs` and `DefaultContent.MissionDesign.cs`). To change a number or a text, edit the JSON. English text for the data lives in `data/en.json`; interface text lives in the code, in `tr('português', 'English')` calls.

## Running locally

JavaScript modules need a server (double-clicking the file does not work):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Soundtrack

| State | Music |
|---|---|
| Title | `abismo_europa_vibrante_ganza` |
| Design and planning | `abismo_europa_calmo_mergulho` |
| Dialogue, rest, victory | `abismo_europa_calma` |
| Exploration and EVA | `abismo_europa_animada_maracas` |
| Abyssal rift, critical resource, defeat | `abismo_europa_ambiente` with a low-pass filter |

## Data used

Ice 15 to 25 km thick and the REASON radar; an ocean 60 to 150 km deep with twice Earth's water; Conamara Chaos (Galileo); salt at Tara Regio (Hubble, 2019) and CO₂ (James Webb, 2023); plumes (Hubble 2012–2016, Galileo 1997, Keck 2019); induced magnetic field (Galileo); 3.5-day orbit and tidal heating; 12 kg/s of oxygen (Juno); Europa Clipper launch on 14 Oct 2024 on a Falcon Heavy, flybys of Mars (2025) and Earth (2026), arrival in 2030, 49 flybys; 7 of the 9 instruments (REASON, E-THEMIS, MISE, ECM, MASPEX, Europa-UVS, EIS) and the gravity and radio science experiment; radiation of 5.4 Sv/day; Galileo launched in 1989, arrived in 1995, sent into Jupiter in 2003; a surface 40 to 90 million years old; the plaque with Ada Limón's poem; Thera Macula (Nature, 2011); hydrothermal vents discovered by Alvin in 1977 (WHOI).

Sources: <https://science.nasa.gov/jupiter/jupiter-moons/europa/> and <https://europa.nasa.gov/>.
