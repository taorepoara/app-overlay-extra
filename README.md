# app-overlay-extra

To install dependencies:

```bash
bun install
```

To run in development mode:

```bash
bun dev
```

To build for production:

```bash
bun run build
```

To start a production server:

```bash
bun start
```


## Scenes

Overlay scenes are managed by setting HTML attribute `data-scene` on the `<main>` element.

Here are the available scenes:
- `start`: initial scene with no media
- `camera`: scene with user camera
- `screen`: scene with screen sharing
- `camera & screen`: scene with both user camera and screen sharing
- `end`: final scene with no media
