# companion-module-venucable-planner

[Bitfocus Companion](https://bitfocus.io/companion) module for [VenuCable](https://venucable.com), the livestream and AV show planner.

- **Building a plan:** one key per item in the user's _My kit_: press it and the item drops into the middle of the plan, selected, ready to drag. Tools, undo/redo, duplicate, turn, delete, zoom, next area, and a Checks key that shows green / amber / red.
- **Show day:** drive VenuCable's live running order: GO / Next, Back, and keys showing the current segment, its countdown (amber in the last minute, red when over), what's next and whether the show is late.

See [companion/HELP.md](companion/HELP.md) for setup.

## How it connects

VenuCable is a web app. A browser can't accept connections, and an https page can't reach a Companion elsewhere on the network, so by default **both sides connect out to VenuCable's relay** (`wss://app.venucable.com/link`, a Cloudflare Durable Object in the VenuCable repo's `relay.js`):

- VenuCable makes a pairing key (26 base32 characters, 130 bits) and shows it under Projects → Stream Deck; the user pastes it into this connection's settings.
- The module connects with `?key=KEY&role=module`, VenuCable with `?key=KEY&role=app` (only from the `https://app.venucable.com` origin). The relay pairs them by the key's SHA-256 and passes messages on: `hello` / `state` from VenuCable to the module, `do` from the module to VenuCable. Each side gets `{ "t": "peer", "app", "module" }` when the other comes or goes. A second Companion with the same key takes over (the first is closed with code 4000 and waits for a settings change).
- Keep-alive: the module sends `ping` every 25 s (the relay answers `pong`) and reconnects after 2 s, doubling to 30 s.

So Companion can run on any computer with internet, with nothing listening on it. For venues without internet there's a **same-computer** option: the module listens on **127.0.0.1** (port 41799 by default) and the VenuCable tab on that computer connects to it, from `https://app.venucable.com` only (plus extra origins set in the config, for testing).

Messages are JSON:

- VenuCable → module: `{ "t": "hello", "app": "VenuCable", "v": 1 }`, then `{ "t": "state", ... }` whenever what the keys show changes (My kit names, tool, checks, live running order with `endAt` so the module counts down itself, the show-timer message / blank in `screen`).
- Module → VenuCable: `{ "t": "do", "a": "<action>", ... }`, e.g. `{ "t": "do", "a": "add", "slot": 1 }`, `"live-go"`, `"tool"` with `"tool": "cable"` or `"route"`, `"finish"`, `"live-nudge"` with `"min": 1`, `"live-hold"`, `"lock"`, `"save"`, `"screen-msg"` with `"msg"`, `"screen-blank"` with `"blank"`.
- The state also carries `undo` / `redo` (anything to undo or redo), `drawing` (a route, room or road being drawn) and `readOnly` (view-only access), so keys can go dark; `locked` (the selected item) and `file` (`{ name, unsaved }` once the plan has a file). On hold, `live` carries `held`, `heldAt` and the frozen `left`.

The module serves no pages. The show timer for vMix / OBS is part of VenuCable (`https://app.venucable.com/timer?room=…`, fed through the relay); the module only sends it messages through VenuCable, and its `screen_url` variable holds the page's address (VenuCable sends it as `timer` in the state). VenuCable feeds the timer through the relay whichever way the module connects.

When a second VenuCable tab connects, the first is closed with code 4000 and reconnects only when it's used again.

## Development

```sh
yarn install      # yarn 4, via corepack (Bitfocus's build rejects npm's lockfile)
yarn test         # link, relay, definitions and the module's main code (with a stand-in for Companion)
yarn lint         # Bitfocus's shared ESLint config
yarn package      # companion-module-build -> venucable-planner-x.y.z.tgz
```

Built on `@companion-module/base` 1.12, so it runs on Companion 4.0 and later.

## License

MIT
