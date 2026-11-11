# Kioku 記憶

A personal Anki-style spaced-repetition flashcard app.

- **FSRS scheduling** (the algorithm behind modern Anki) via [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)
- **Google sign-in + Firestore sync** with offline persistence — review on any device
- **PWA** — installable, works offline
- **Stats dashboard** — review heatmap, streak, retention, due forecast
- **JSON deck import/export** designed so an AI assistant (or a script) can generate decks
  from your notes and push them straight into the app
- Furigana support on cards: `漢字[かんじ]` renders as ruby text

Built with React 19, TypeScript, Vite, Tailwind CSS v4, and Firebase. Hosted on GitHub Pages.

## Running your own

1. Create a Firebase project with Google authentication and Firestore, then put your web-app
   config in `src/lib/firebase.ts` and deploy `firestore.rules`.
2. `npm install && npm run dev`
3. To deploy: `npm run deploy` publishes the build to a `gh-pages` branch for GitHub Pages.
4. Optional CLI deck pushing: save a service-account key to `scripts/service-account.json`
   and `{ "email": "<your-app-account>" }` to `scripts/push-config.json`, then
   `npm run push -- decks/my-deck.json`.

Deck JSON format:

```json
{
  "deck": "Deck name",
  "description": "optional",
  "cards": [{ "front": "question", "back": "answer", "notes": "optional", "tags": ["optional"] }]
}
```
