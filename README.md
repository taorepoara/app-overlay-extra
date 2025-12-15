# app-overlay-extra

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.4. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.


## Scenes

Overlay scenes are managed by setting HTML attribute `data-scene` on the `<main>` element.

Here are the available scenes:
- `start`: initial scene with no media
- `camera`: scene with user camera
- `screen`: scene with screen sharing
- `camera-screen`: scene with both user camera and screen sharing