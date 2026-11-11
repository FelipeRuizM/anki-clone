import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Spinner } from './components/ui'
import { StoreProvider, useStore } from './lib/store'
import Decks from './pages/Decks'
import DeckDetail from './pages/DeckDetail'
import ImportPage from './pages/ImportPage'
import SignIn from './pages/SignIn'
import Stats from './pages/Stats'
import Study from './pages/Study'

function Shell() {
  const { user, authLoading } = useStore()
  if (authLoading) return <Spinner label="Waking up…" />
  if (!user) return <SignIn />
  return (
    <Routes>
      <Route path="/study/:deckId" element={<Study />} />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Decks />} />
              <Route path="/deck/:id" element={<DeckDetail />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/import" element={<ImportPage />} />
              <Route path="*" element={<Decks />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  )
}
