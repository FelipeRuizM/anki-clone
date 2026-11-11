import { useState } from 'react'
import { IconGoogle, LogoMark } from '../components/icons'
import { useStore } from '../lib/store'

export default function SignIn() {
  const { signInWithGoogle } = useStore()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (e) {
      setError((e as Error).message ?? 'Sign-in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="fade-up flex w-full max-w-sm flex-col items-center text-center">
        <LogoMark size={72} />
        <h1 className="mt-5 text-4xl font-extrabold tracking-tight">
          Kioku <span className="font-normal text-zinc-400">記憶</span>
        </h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          Flashcards that know when you're about to forget.
        </p>
        <button
          onClick={go}
          disabled={busy}
          className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-semibold shadow-sm transition hover:bg-zinc-50 active:scale-[0.99] disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          <IconGoogle />
          Continue with Google
        </button>
        {error && <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <p className="mt-6 text-xs text-zinc-400 dark:text-zinc-500">
          Your decks and progress sync to your account and work offline.
        </p>
      </div>
    </div>
  )
}
