Libraries used

┌───────────────────────────────────┬────────────────────────────────────────────────────────────────┐
│              Library              │                            Used for                            │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ next                              │ App framework, routing, dynamic import                         │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ react                             │ Components, hooks, state                                       │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ tailwindcss                       │ Utility CSS (v4, CSS-based config)                             │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ three                             │ 3D geometry, math, materi         │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ @react-three/fiber                │ React renderer for Three.         │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ @react-three/drei                 │ OrbitControls, Grid, Html         │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ lucide-react                      │ All icons throughout the          │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ recharts                          │ Loudness history line cha         │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ shadcn/ui (button, slider, badge) │ Base UI primitives                │
├───────────────────────────────────┼────────────────────────────────────────────────────────────────┤
│ Web Audio API (browser built-in)  │ PannerNode HRTF, GainNodeurceNode │
└───────────────────────────────────┴────────────────────────────────────────────────────────────────┘

Installed but not meaningfully used: howler, tone, use-sound, framer-motion — the Web Audio API handles everything directly.

---
Dolby Atmos Renderer feature coverage

Implemented (~18 features)
- 3D room wireframe with floor grid
- Draggable audio object spheres with HRTF spatial positioning
- OrbitControls camera (orbit, pan, zoom)
- Speaker presets: 5.1, 7.1, 7.1.4, 9.1.6 with cone meshes
- Binaural HRTF rendering via Web Audio PannerNode
- Object list with X/Y/Z numeric controls
- Automation lane (X-position over time, editable control points)
- Routing matrix (object → output channel routing grid)
- LU/LUFS loudness metering (momentary, short-term, integrated, true peak)
- ITU-R BS.1770-4 loudness math
- Loudness history chart (90-point rolling)
- Per-channel meters (L, R, C, Ls, Rs, LFE)
- Speaker configuration panel with 2D diagram + per-speaker angle/distance editing
- Transport: Play, Pause, Stop, Rewind, Record toggle
- Seek bar with scrub-to-position
- HH:MM:SS:FF timecode display
- Master gain control
- Headphones/Speakers output mode toggle
- File import (multi-file, drag-drop)
- 2D top-down minimap
- Lock/unlock 3D viewer (L key + button)
- Camera zoom in/out buttons

Missing (~20 features)
- Bed channels (channel-based audio objects, not just objects)
- Dolby AC-4 / AC-3 codec encode/decode
- ADM (Audio Definition Model) XML metadata import/export
- Binaural room correction / HRTF dataset selection
- Object automation playback (the lane exists but doesn't drive position during playback)
- Room acoustics / reverb modeling
- Dynamic object count beyond the buffer limit
- Input bus monitoring (live mic/line input)
- Loudness normalization (auto-level to target LUFS)
- Dialogue intelligence / loudness gating
- B-chain / mastering chain insert slots
- Hardware I/O routing (ASIO/CoreAudio device selection)
- Timecode sync (MTC, LTC, video lock)
- Re-rendering to different channel configurations
- Dolby Atmos Master File (.atmos) import/export
- Pro Tools / DAW session interchange
- Trim automation per channel
- Headphone virtualizer presets (different HRTF datasets)
- Real-time loudness correction / limiter
- Surround panner automation (azimuth/elevation curves)

 render multi-channel Atmos beds , required non browser aproch