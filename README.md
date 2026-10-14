# The Quiet

A local, explorable liminal landscape inspired by the supplied video: an endless grass plateau, a sheer drop, drifting clouds, a pink house, and a very long ladder.

## Run

```sh
cd "/Users/mohsen/Nova/Experiments/Backrooms/The Quiet"
bun install
bun run dev
```

Use Bun 1.3.14 or newer. Open the local URL shown by Vite. Click anywhere to enter and enable sound. A browser with WebGL 2 is required. Mouse capture is used when available; embedded browsers fall back to click-and-drag to look.

- **WASD / arrow keys** — move; **mouse** — look.
- **F** or the small **FLY / WALK** label — switch between flying and walking. Switching to walking keeps your exact position and look direction; you fall if airborne and land on the surface below. Switching back to flying stops the fall in place.
- **Space / E** — rise in flight; **Q / Control** — descend.
- **Hold Shift** — fly faster or run; releasing it immediately restores the slow pace; **Space** — jump while walking.
- **E** beside the ladder — grab or let go. **W / S** — climb up / down. Release movement keys to hold your rung; the mouse remains free to look around. Back toward the top with **S** to begin descending, or approach the bottom with **W** to climb. **Space** deliberately releases your grip.
- **Escape** — pause, release the pointer, and fade the audio.
- **Touch** — drag the left side to move and the right side to look; double tap to switch modes. Look upward while moving forward to ascend.

The entrance camera drifts until you enter. Reduced-motion preferences disable this drift. Sound starts only after interaction and fades when paused or the tab loses focus.

Built with React, Three.js, Tailwind CSS, GSAP, and Web Audio. The cloud volumes, terrain, and quiet wind are procedural. Turf uses a locally generated photographic texture. Footsteps use the three recordings in `public/audio/`; ladder steps alternate left and right. There are no remote asset requests. The house is an exterior landmark. Nothing is deployed.

```sh
bun test       # terrain, collisions, cloud clearance, and ladder movement
bun run build # TypeScript + production build
```

Normal flight is 4.5 m/s and walking is 1.8 m/s. Holding Shift increases these to 28 m/s and 5.5 m/s. Wind stays quiet and varies only slightly with movement. The upper field extends past the visible range; volumetric valley clouds clear the cliff and ground with their entire enclosing bounds, while sky clouds stay above the plateau. Clouds have internal light scattering and cast soft projected shadows across the field and cliff. Grass uses short, muted blades over a detailed turf surface, with varied texture sampling to reduce repetition.

The sky surrounds the visitor with 576 clouds across varied heights, plus 18 valley clouds. Up to eight nearby clouds use volume rendering; distant clouds share one instanced draw using pre-integrated textures. The three 128³ volumes use about 24 MiB of GPU data. Rebuild the local cloud assets with `bun scripts/bake-clouds.ts`. Distant clouds fade before recycling beyond the visible area. The sky renders behind all terrain, and shared atmospheric colors soften the field and cliff into the horizon. There is no center reticle in either movement mode. Clouds drift gently on a shared breeze; a hazy sun disk follows the same direction as the scene lighting and cloud shadows.

Terrain is an exterior shell with no overlapping caps. House meshes are batched by material and static shadows render once. Ground mist depends on distance and height above the field; cliff faces use distance haze only. Grass geometry is shown only near the ground. Rendering caps its pixel budget and adapts downward if sustained frame times exceed the target. The canvas `data-scene-stats` attribute provides local frame time and draw-cost diagnostics without adding controls.
