// Push one or more deck JSON files straight into the app's Firestore.
//
//   npm run push -- decks/jpst-ch4-vocab.json [more.json ...]
//
// Needs (both gitignored):
//   scripts/service-account.json  — Firebase service-account key
//   scripts/push-config.json      — { "email": "<account the app is signed in with>" }
//
// Idempotent: cards whose front already exists in the target deck are skipped.
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { createEmptyCard } from 'ts-fsrs'

const here = dirname(fileURLToPath(import.meta.url))

async function loadJson(path, what) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (e) {
    console.error(`Could not read ${what} at ${path}: ${e.message}`)
    process.exit(1)
  }
}

const files = process.argv.slice(2)
if (files.length === 0) {
  console.error('Usage: npm run push -- <deck.json> [more.json ...]')
  process.exit(1)
}

const serviceAccount = await loadJson(join(here, 'service-account.json'), 'service account key')
const config = await loadJson(join(here, 'push-config.json'), 'push config')
if (!config.email) {
  console.error('push-config.json must contain { "email": "..." }')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

let user = await getAuth()
  .getUserByEmail(config.email)
  .catch(() => null)
if (!user) {
  // Fall back: if exactly one user exists, use it (and say so).
  const all = await getAuth().listUsers(10)
  if (all.users.length === 1) {
    user = all.users[0]
    console.log(`Note: ${config.email} not found; using the only account: ${user.email}`)
  } else {
    console.error(
      `No Firebase user found for ${config.email}. Sign in to the app once with Google first,` +
        ` or fix the email in scripts/push-config.json. Accounts found: ${all.users.map((u) => u.email).join(', ') || '(none)'}`,
    )
    process.exit(1)
  }
}
const uid = user.uid
const base = `users/${uid}`

function emptySrs(now) {
  const c = createEmptyCard(new Date(now))
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps ?? 0,
    reps: c.reps,
    lapses: c.lapses,
    state: Number(c.state),
    last_review: null,
  }
}

const decksSnap = await db.collection(`${base}/decks`).get()
const decksByName = new Map(
  decksSnap.docs.map((d) => [String(d.data().name ?? '').toLowerCase(), d.id]),
)

for (const file of files) {
  const data = await loadJson(file, 'deck file')
  const name = String(data.deck ?? '').trim()
  const cards = Array.isArray(data.cards) ? data.cards : []
  if (!name || cards.length === 0) {
    console.error(`${file}: needs { "deck": "...", "cards": [{ "front", "back" }, ...] } — skipped`)
    continue
  }

  let deckId = decksByName.get(name.toLowerCase())
  if (!deckId) {
    const now = Date.now()
    const ref = await db.collection(`${base}/decks`).add({
      name,
      description: String(data.description ?? ''),
      newPerDay: 20,
      createdAt: now,
      updatedAt: now,
    })
    deckId = ref.id
    decksByName.set(name.toLowerCase(), deckId)
    console.log(`Created deck "${name}"`)
  }

  const existing = await db
    .collection(`${base}/cards`)
    .where('deckId', '==', deckId)
    .select('front')
    .get()
  const fronts = new Set(existing.docs.map((d) => String(d.data().front ?? '').trim().toLowerCase()))

  const fresh = []
  let skipped = 0
  for (const card of cards) {
    const front = String(card.front ?? '').trim()
    const back = String(card.back ?? '').trim()
    const key = front.toLowerCase()
    if (!front || !back || fronts.has(key)) {
      skipped++
      continue
    }
    fronts.add(key)
    fresh.push({
      front,
      back,
      notes: String(card.notes ?? ''),
      tags: Array.isArray(card.tags) ? card.tags.map(String) : [],
    })
  }

  let ts = Date.now()
  for (let i = 0; i < fresh.length; i += 400) {
    const batch = db.batch()
    for (const card of fresh.slice(i, i + 400)) {
      const now = ts++
      batch.set(db.collection(`${base}/cards`).doc(), {
        deckId,
        ...card,
        createdAt: now,
        updatedAt: now,
        ...emptySrs(now),
      })
    }
    await batch.commit()
  }
  console.log(`${file} → "${name}": added ${fresh.length}, skipped ${skipped} (duplicate/empty)`)
}

console.log('Done.')
