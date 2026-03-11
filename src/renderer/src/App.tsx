import { useEffect } from 'react'
import { useVerseStore } from './stores/verseStore'
import SearchBar from './components/SearchBar'
import MicButton from './components/MicButton'
import MicPicker from './components/MicPicker'
import VersePreview from './components/VersePreview'
import VerseHistory from './components/VerseHistory'
import MonitorPicker from './components/MonitorPicker'
import VoiceStatus from './components/VoiceStatus'

export default function App() {
  const { setMonitors } = useVerseStore()

  useEffect(() => {
    window.api.getMonitors().then(setMonitors)
  }, [setMonitors])

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 flex flex-col">
      <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Speech to Verse</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Church Presentation System</p>
          </div>
          <MonitorPicker />
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row gap-0">
        <main className="flex-1 flex flex-col p-6 gap-5">
          <SearchBar />
          <VersePreview />
        </main>

        <aside className="lg:w-80 bg-zinc-800/50 border-t lg:border-t-0 lg:border-l border-zinc-700 p-5 flex flex-col gap-5">
          <div className="space-y-4">
            <MicPicker />
            <MicButton />
            <VoiceStatus />
          </div>
          <div className="flex-1 min-h-0">
            <VerseHistory />
          </div>
        </aside>
      </div>
    </div>
  )
}
