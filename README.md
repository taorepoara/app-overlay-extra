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


## Twitch integration

Features:
- Notify:
  - new tchat messages: add guitare sound
  - new follower: add guitare solo sound + confetti
	- new/renew subscriber: add guitare solo sound + confetti
- Récupération de la clé de streaming (pour lancer via FFMPEG)
- Ajouter en Guest la personne qui stream (pour récupérer l'afficher sur le stream de la chaîne commune)
- Nombre d'abonnés
- Nombre de followers
- En fin de stream:
  - Ajouter le prochain stream dans le calendrier
  - Définir les infos du live (titre, catégorie, etc.)
  
## Improve style

- [ ] Animation logo Lenra pendant transition
- [ ] Déplacer les data en bas de l'écran
- [x] Possibilité de cacher les éléments d'interface via admin
- [x] Couper le son via admin
- [x] Couper micro via admin
- Son:
  - [ ] Ajouter la guitare
  - [ ] Ajouter la batterie via [strudel](https://strudel.cc/) (voir https://strudel.cc/technical-manual/project-start/#with-your-own-ui) (banques de son de batterie: https://github.com/geikha/tidal-drum-machines/tree/main/machines)