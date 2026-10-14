# Super Pixel Dash

A retro 2D platformer that runs in the browser, inspired by classic 8-bit platformers and arcade "barrel" games. It has five worlds and a three-phase boss. You can sign in with Google to post to a global leaderboard, or play offline with scores saved on your device.

- **No build step and no dependencies.** It is plain HTML5 Canvas, vanilla JavaScript (ES2017+) and CSS.
- **No asset files.** Every sprite, tile and background is drawn in code. Every sound effect and chiptune is synthesized with the Web Audio API.
- **Leaderboard.** Firebase Auth (Google Sign-In) and Cloud Firestore power the global board. A `localStorage` fallback means the game works offline and before Firebase is set up.
- **Hosting.** It deploys to GitHub Pages automatically through GitHub Actions.

---

## The worlds

| # | World | Theme and hazards |
|---|-------|-------------------|
| 1 | **Grassland** | Rolling hills, green pipes, `?` blocks, mushroom walkers, a barrel stack that keeps rolling barrels at you, and a moving platform |
| 2 | **Crystal Cavern** | Dark bricks and glowing crystals. Only a small area around you is lit. Ceiling drips, swooping bats, spike floors and crumbling rocks |
| 3 | **Sky Kingdom** | One-way cloud platforms, horizontal and vertical moving platforms, headwind and tailwind gusts, and bottomless sky |
| 4 | **Lava Castle** | Rotating fire bars, leaping lava fireballs, crumbling bridges over lava, and a climb while the lava rises |
| 5 | **Iron Fortress** | A short gauntlet, then a locked arena with **Grokk the Iron Ape**: 9 HP across 3 phases, with a health bar and attacks you can dodge |

**How the boss fights:**

- **Phase 1:** walks, throws barrels and leaps at you.
- **Phase 2:** adds ground-pound shockwaves and 3-way fireball spreads.
- **Phase 3:** enraged and faster. Adds 5-way spreads, double barrel throws and a fireball rain with warning markers.

Stomp his head while he isn't flashing. He is stunned for a moment after each ground pound, which is your opening.

## Controls

| Action | Keyboard | Gamepad | Touch |
|--------|----------|---------|-------|
| Move | ← → / A D | D-pad / left stick | ◀ ▶ |
| Jump (hold to jump higher) | ↑ / W / Space / Z | A | A |
| Crouch | ↓ / S | Down | ▼ |
| Sprint | Shift / X | B / X | B |
| Pause | P / Esc | Start | II |
| Mute | M | – | – |

You can also navigate the menus with ↑/↓ and Enter.

**Physics features:** acceleration and friction, faster turnaround, coyote time (6 frames), jump buffering (7 frames), variable jump height, stomp bounces (hold Jump to bounce higher), one-way platforms, and platforms you can ride.

## Scoring

Each world you clear is scored as:

```
World Score = (Coins Collected × 500) + Max(0, 10000 − (TimeTakenInSeconds × 50))
```

- Your run score is the sum of your world scores.
- If you get a Game Over partway through a world, you still get the coin points from that world, but no time bonus.
- Every 50 coins gives you an extra life.
- You have 3 lives per run and 3 HP per life. Pits and lava kill instantly.
- Checkpoint flags save your respawn point.

---

## Quick start (local)

The game itself will run if you open `index.html` directly, but Google Sign-In and the Firebase SDK need a real `http(s)` origin. Serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Any static server works, for example `npx serve`.

> Add `?unlockall` to the URL to unlock every world in level select, which is handy for testing.

## File structure

```
index.html                    Canvas, HUD and every UI overlay (title, login, level select, leaderboard, pause, tally, game over, victory)
style.css                     Pixel-font UI, CRT scanline overlay, responsive scaling, touch controls
js/game.js                    Game loop (fixed 60 Hz step), input, physics, collisions, particles, rendering, UI glue
js/levels.js                  Tile set, 5 world themes, level layouts (builder DSL), enemy pixel art, enemy AI and boss AI
js/audio.js                   Web Audio synthesizer: sound effects, jingles, step-sequencer chiptunes
js/firebase.js                Google Sign-In, Firestore high scores, local fallback and retry queue
firestore.rules               Security rules for the `pixeldash_scores` collection
.github/workflows/deploy.yml  GitHub Pages deployment on every push to `main`
```

---

## Firebase setup (global leaderboard)

The game works without Firebase: scores are saved to `localStorage` and the leaderboard shows "LOCAL (THIS DEVICE)". Follow these steps to turn on Google Sign-In and the global board.

> **Current setup:** the live game uses the existing **MP3 Player IOS** Firebase project (`mp3-player-ios`) through its own web app, *Super Pixel Dash*. The leaderboard lives in its own collection, `pixeldash_scores`, separate from the MP3 app's data. Google sign-in is shared with that project, so game players appear in its Authentication user list.
>
> You can also use a project that already belongs to another app. Register a new web app in it, then follow steps 2–4. In step 4, **merge** the rules instead of replacing them.

### 1. Create a project and a web app

1. Go to the [Firebase console](https://console.firebase.google.com/) and click **Add project**. Google Analytics is optional.
2. On the project overview, click the **Web** icon (`</>`) to register a web app. You don't need Firebase Hosting.
3. Copy the `firebaseConfig` object that Firebase shows you.

### 2. Paste the config

Open `js/firebase.js` and replace the placeholders:

```js
const FIREBASE_CONFIG = {
  apiKey: 'AIza...',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '1234567890',
  appId: '1:1234567890:web:abc123',
};
```

> A Firebase web config is **not a secret**. It ends up in every visitor's browser. Your data is protected by the security rules and the authorized domains list below.
>
> **If you'd rather not commit it:** leave the placeholders in place. Then add a repository secret named `FIREBASE_CONFIG` (Settings → Secrets and variables → Actions) that contains the config as JSON, for example `{"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}`. The deploy workflow injects it at build time.

### 3. Enable Google Sign-In

1. Go to **Build → Authentication → Get started**.
2. Open the **Sign-in method** tab, enable **Google**, choose a support email and save.
3. Open the **Settings** tab, go to **Authorized domains** and add every domain that will host the game:
   - `localhost` (already there by default)
   - `<your-username>.github.io`
   - your custom domain, if you have one

### 4. Create Firestore and apply the rules

1. Go to **Build → Firestore Database → Create database**, pick a location and start in **production mode**.
2. Open the **Rules** tab, paste the contents of [`firestore.rules`](firestore.rules) and click **Publish**.

> **Using a project that other apps also use?** Publishing rules **replaces all** of the project's rules. Copy only the `match /pixeldash_scores/{scoreId}` block into the existing rules, just above any catch-all `match /{document=**}` rule. Also add it to that app's own `firestore.rules` file, so its next deploy keeps the leaderboard.

The rules work like this:

- Anyone can read the leaderboard.
- Only a signed-in user can add a score, and only under their own `uid`.
- Field types and ranges are validated. The `createdAt` timestamp must come from the server.
- Scores can't be edited or deleted from the client.

Firestore creates the single-field index that the `orderBy('score', 'desc')` query needs automatically. You don't need to create one.

> **Anti-cheat note:** the game logic runs in the client. The rules reject impossible values, such as more coins than exist or scores above the theoretical maximum of about 162,000. They can't fully stop a determined cheater. For a competitive board, validate runs in a Cloud Function.

### What gets stored

Collection `pixeldash_scores`, one document per finished run:

| Field | Type | Notes |
|-------|------|-------|
| `uid` | string | Firebase Auth uid |
| `name` | string | Google display name (max 24 characters) |
| `photoURL` | string | Google avatar URL |
| `level` | int | World reached (1–5) |
| `cleared` | bool | `true` if the boss was beaten (shown as ★) |
| `coins` | int | Total coins in the run |
| `time` | int | Total seconds in the run |
| `score` | int | Total score in the run |
| `createdAt` | timestamp | Server time |

If an upload fails (offline, timeout), the score is kept in a local retry queue. The game uploads it automatically the next time that player signs in.

---

## Deploying to GitHub Pages

1. Create a GitHub repository and push this project to the `main` branch:

   ```bash
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Every push to `main` now runs `.github/workflows/deploy.yml`. The workflow:
   - checks the syntax of every JS file,
   - assembles `index.html`, `style.css` and `js/` into `_site`,
   - optionally injects the `FIREBASE_CONFIG` secret,
   - publishes the site.

   You can also run it by hand from the **Actions** tab, using *Run workflow*.
4. The site is served at `https://<you>.github.io/<repo>/`. Remember to add `<you>.github.io` to Firebase's **Authorized domains**.

All asset paths are relative, so the game works from a project sub-path with no extra configuration.

---

## Customising

### Levels

Each world in `js/levels.js` is built with a small builder DSL on a grid 14 rows tall:

```js
b.ground(0, 40);               // solid ground, columns 0–40
b.row(14, 8, 'B?B?B');         // bricks and ? blocks on row 8
b.pipe(24, 2);                 // 2-wide pipe, 2 tiles tall
b.coins(36, 9, 3);             // a row of coins
b.enemy('walker', 20, 11);     // enemy standing on row 11
b.enemy('platform', 119, 10, { w: 3, axis: 'x', range: 5, speed: 0.8 });
b.checkpoint(100);
b.goal(192);
```

The characters `row()` understands:

| Character | Tile |
|-----------|------|
| `#` | ground |
| `B` | brick |
| `?` | ? block |
| `S` | stone |
| `=` | one-way platform |
| `~` | crumbling tile |
| `^` | spikes |
| `L` | lava |
| `o` | coin |
| `*` | crystal (decoration) |

**Physics budget for level design:** a walking jump rises about 4.6 tiles (enough to stand on a brick row 4 tiles above the ground) and reaches about 6 tiles across.

### Enemies and hazards

Each type is a behaviour object in `Levels.BEHAVIORS` with `init`, `update`, `draw` and optional `onStomp`, `onBump`, `onTouch` and `collide` hooks. The available types are:

`walker`, `spiny`, `flyer` (hover, patrol or swoop), `barrel`, `barrelSpawner`, `fireball`, `podoboo`, `firebar`, `drip`, `platform`, `wind`, `risingLava`, `checkpoint`, `goal`, `bossTrigger`, `shockwave`, `boss`.

### Look and sound

- **Themes:** the `THEMES` palettes in `js/levels.js`.
- **Player sprite:** `PLAYER_ART` in `js/game.js`. Sprites are strings of characters, and an outline is added automatically.
- **Music:** `SONGS` in `js/audio.js`. Each track is a string of eighth-note steps, using note names, `-` for a rest and `~` to hold a note.

## Debugging

Open the browser console:

- `SPD.G` shows the live game state.
- `SPD.loadLevel(3)` jumps to World 4.
- `SPD.step(60, { right: true, jump: true })` advances 60 frames with keys held. It's useful for scripted tests.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Firebase is not configured yet" | Paste your config into `js/firebase.js`, or set the `FIREBASE_CONFIG` secret |
| `auth/unauthorized-domain` | Add the domain under Authentication → Settings → Authorized domains |
| `auth/operation-not-allowed` | Enable the Google provider under Authentication → Sign-in method |
| Leaderboard shows LOCAL even after setup | Check the console. Usually the Firestore database hasn't been created yet or the rules haven't been published |
| Popup blocked | The game falls back to redirect sign-in automatically |
| No sound | Browsers start audio only after your first click or key press. Also check the SOUND toggle (M) |
| Sign-in fails when opened as a file | Serve it over HTTP (see Quick start) |

## Credits

All code, pixel art, music and sound effects are original and generated procedurally. The game is inspired by classic 8-bit platformers. It is not affiliated with or endorsed by Nintendo.
