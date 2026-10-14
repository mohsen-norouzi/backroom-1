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

Built with React, Three.js, Tailwind CSS, GSAP, and Web Audio. The cloud volumes, terrain, and quiet wind are procedural. Turf uses a locally generated photographic texture. Footsteps use the three recordings in `public/audio/`; ladder steps alternate left and right. The supplied `song.wav` plays on a loop from inside the house using a streamed `house-song.mp3` copy. The entire song is a mono point source fixed inside the house, including its faint outdoor reflections. Turning or moving changes its HRTF direction; distance makes it softer and more muffled, with a faint directional signal remaining audible across the world. The direct sound stays at that interior source. The closed cottage has one consistent enclosure filter across walls, windows, door and roof, with a smooth transition only for a listener entering the room. Outdoor reflections come from two fixed cliff-edge locations with fixed arrival times and slowly smoothed distance-based levels. Every route is spatialized; there is no stereo background bed. Pausing fades and stops the song; re-entering resumes its playhead. The original WAV is preserved. There are no remote asset requests. The house is an exterior landmark. Nothing is deployed.

```sh
bun test       # terrain, collisions, cloud clearance, and ladder movement
bun run build # TypeScript + production build
```

Normal flight is 4.5 m/s and walking is 1.8 m/s. Holding Shift increases these to 28 m/s and 5.5 m/s. Wind is a quiet, seamless 16-second coloured-noise breeze, with low rumble filtered out and slow irregular changes independent of movement speed. The former 54 Hz drone is removed. The music first reverberates inside a small room, then passes through the house walls. Outdoor echoes are silent within 40 metres, then blend in smoothly to full strength at 220 metres. Their two arrivals stay fixed at 0.48 and 0.76 seconds and diffuse into a 3.2-second tail. Delay times are never automated, preventing pitch warble during movement. Echo gain and tone depend only on distance from the house, so circling it does not pump the mix. The direct source uses HRTF positioning; the quieter reflections use equal-power panning to avoid competing HRTF colour changes. Nearby, only a short, quiet room resonance accompanies the wall-filtered source. They have no feedback loop and remain anchored to the cliff when the listener turns or moves. Footsteps retain their lighter 1.85-second reflection. The upper field extends past the visible range; volumetric valley clouds clear the cliff and ground with their entire enclosing bounds, while sky clouds stay above the plateau. Clouds have internal light scattering and cast soft projected shadows across the field and cliff. Grass uses short, muted blades over a detailed turf surface, with varied texture sampling to reduce repetition.

The sky surrounds the visitor with 576 distant clouds in three uneven altitude bands, 24 closer formations over the plateau (16 hovering low above the grass), and 18 valley clouds. Their full volume bounds stay clear of the terrain and the cottage approach. Every cloud keeps the same world-fixed 3D density and orientation at every viewing distance. Visible volumes share one instanced draw with a fixed sampling pattern; there are no camera-facing cards or nearest-cloud representation swaps. Offscreen and fully hazed clouds are culled. The three 128³ density/light volumes share one RG atlas using 16 MiB of GPU data. Rebuild the local cloud assets with `bun scripts/bake-clouds.ts`. Distant clouds fade before recycling beyond the visible area. The sky renders behind all terrain, and shared atmospheric colors soften the field and cliff into the horizon. There is no center reticle in either movement mode. Clouds drift gently on a shared breeze; a hazy sun disk follows the same direction as the scene lighting and cloud shadows.

Terrain is an exterior shell with no overlapping caps. House meshes are batched by material and static shadows render once. Ground mist depends on distance and height above the field; cliff faces use distance haze only. Grass uses three overlapping, world-anchored detail ranges: curved near blades, middle-distance tufts, and coarse tufts fading between 145 and 215 metres. It stays visible during low flight. The cliff front and all three ladder-recess walls have outward-growing blades over their full height. Grass inherits its turf texture colour, uses stable staggered transitions, and shares the terrain’s haze and cloud shadows. Only surface patches beyond the visible range are culled. Rendering caps its pixel budget and adapts downward if sustained frame times exceed the target. The canvas `data-scene-stats` attribute provides local frame time and draw-cost diagnostics without adding controls.

The cottage has a continuous cross-gabled plaster shell, individually curved roof tiles, ridge caps, a skylight, inset divided windows, a paneled door, and a leaf-and-flower garden. Fine micro-relief responds to daylight on plaster, paint, stone, and tiles. A new muted photographic turf map replaces the earlier wiry texture; nearby curved blades and a rounded, grass-fringed cliff lip add depth. Sun shadows use a prefiltered variance map for soft edges without repeated shadow sampling during movement. All upper-cloud ground shadows share one repeating 4 MiB map and drift with the same wind as their clouds. Shadow penumbras are prefiltered according to each cloud’s height: low formations retain defined cores, while higher shadows spread into broad, softer transitions. Layer identity prevents low plateau shadows from being applied twice. The field stays shaded into the distance with one texture lookup and no extra shadow render passes.

The ladder and rear recess lean forward by 30 metres over the 255-metre descent (about 6.7 degrees). One slope definition drives the walls, rails, rungs, grass roots, collisions, and climbing camera. The recess and ladder use continuous sun visibility against the side walls, a soft penumbra at the opening, and reduced sky fill deeper inside; they do not sample the cottage’s limited shadow map. Releasing movement still holds the current rung while looking around.
