import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useStore } from '../lib/store'
import { IconChart, IconLogout, IconMoon, IconSun, IconUpload, LogoMark } from './icons'

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* private mode */
    }
  }
  return (
    <button
      onClick={toggle}
      className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
    </button>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { signOutUser } = useStore()
  const link = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300'
        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
    }`
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4">
      <header className="sticky top-0 z-40 -mx-4 mb-4 border-b border-zinc-200/70 bg-zinc-50/85 px-4 backdrop-blur dark:border-zinc-800/70 dark:bg-zinc-950/85">
        <nav className="flex h-14 items-center justify-between">
          <NavLink to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <LogoMark size={26} />
            <span>
              Kioku <span className="font-normal text-zinc-400">記憶</span>
            </span>
          </NavLink>
          <div className="flex items-center gap-0.5">
            <NavLink to="/stats" className={link} title="Stats">
              <IconChart width={17} height={17} />
              <span className="hidden sm:inline">Stats</span>
            </NavLink>
            <NavLink to="/import" className={link} title="Import">
              <IconUpload width={17} height={17} />
              <span className="hidden sm:inline">Import</span>
            </NavLink>
            <ThemeToggle />
            <button
              onClick={signOutUser}
              className="rounded-xl p-2 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              title="Sign out"
            >
              <IconLogout width={18} height={18} />
            </button>
          </div>
        </nav>
      </header>
      <main className="flex-1 pb-12">{children}</main>
    </div>
  )
}
