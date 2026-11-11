# Kioku (記憶) — spaced-repetition flashcards

Personal Anki-style app. React 19 + Vite + TypeScript + Tailwind v4, Firebase (Google auth +
Firestore with offline cache), FSRS scheduling via `ts-fsrs`, PWA. Deployed to GitHub Pages.

- **Live app:** https://feliperuizm.github.io/anki-clone/
- **Firebase project:** `kioku-f9m2x` (console: https://console.firebase.google.com/project/kioku-f9m2x)
- **Deploy:** push to `main` → GitHub Actions → Pages. Firestore rules: `firebase deploy --only firestore`.

## The flashcard-generation workflow (most common request)

When the user asks to "make flashcards from my <X> notes":

1. Notes live in the Obsidian vault: `C:\Users\felip\Desktop\Home\Obsidian Vault\big-brain`
   - JPST 100 (UBC first-year Japanese): `UBC\Winter 1\JPST 100\` — chapters have
     `! Chapter N Vocab - AI.md`, `Kanji\` subfolders, and `Grammar - … - AI.md` notes.
   - Other courses under `UBC\`.
2. Read the relevant notes and write a deck JSON into `decks/` (gitignored — personal content):
   ```json
   {
     "deck": "JPST 100 · Ch. 4 Vocab",
     "description": "Vocabulary from Chapter 4 — The First Date",
     "cards": [
       { "front": "先生[せんせい]", "back": "teacher", "notes": "optional mnemonic/example", "tags": ["ch4", "vocab"] }
     ]
   }
   ```
3. Push it: `npm run push -- decks/<file>.json` — idempotent (skips duplicate fronts), so
   re-running after edits is safe. Needs `scripts/service-account.json` and
   `scripts/push-config.json` (both exist locally, gitignored; config holds the app account email).
   The target user must have signed into the app at least once.

### Card-writing guidelines
- Front/back/notes support `**bold**`, `*italic*`, `` `code` ``, newlines, and furigana ruby:
  `漢字[かんじ]` (bracket reading after CJK text renders as ruby).
- Japanese vocab: front = Japanese (with furigana), back = English. Kanji decks: front = the
  kanji alone, back = reading + meaning. Grammar: front = a prompt/sentence with a blank or
  "How do you say…", back = the pattern + example.
- Keep one fact per card; prefer many small cards over few dense ones. Tag by chapter/topic.
- Default 20 new cards/day per deck (deck setting in the app).

## Architecture notes

- All data in Firestore under `users/{uid}/…`: `decks/`, `cards/` (flat, FSRS fields stored on
  each card as epoch-millis numbers), `reviews/` (one log per answer), `stats/daily` (single doc,
  per-day aggregate map used by the Stats page).
- `src/lib/store.tsx` — auth + live snapshots + all writes (review/undo batches).
  `src/lib/fsrs.ts` — ts-fsrs v6 conversions. `src/lib/queue.ts` — due logic & queue building.
- Routing is HashRouter (GitHub Pages). Vite `base` is `/anki-clone/`.
- Day rollover is local midnight. "New today" is derived from review logs where `stateBefore == 0`.
- `scripts/push-deck.mjs` mirrors the app's import logic (dedupe by front, batch writes).

## Commands
- `npm run dev` / `npm run build` / `npm run lint`
- `npm run push -- decks/foo.json` — push a deck to the live app
- `npm run icons` — regenerate PWA icons from `public/icon.svg`
