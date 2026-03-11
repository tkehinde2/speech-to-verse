import { useState, useCallback } from 'react'
import { useVerseStore } from '../stores/verseStore'
import type { DisplayContent, Verse } from '../lib/types'

export default function SearchBar() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setContent, selectedMonitor, displayVisible } = useVerseStore()

  const handleSearch = useCallback(async () => {
    const ref = input.trim()
    if (!ref) return

    setLoading(true)
    setError('')

    try {
      const match = ref.match(/^(.+?)\s+(\d+):(\d+)(?:\s*-\s*(\d+))?$/)
      if (!match) {
        setError('Format: Book Chapter:Verse (e.g., John 3:16 or John 3:16-18)')
        setLoading(false)
        return
      }

      const book = match[1].trim()
      const chapter = parseInt(match[2], 10)
      const verseStart = parseInt(match[3], 10)
      const verseEnd = match[4] ? parseInt(match[4], 10) : undefined

      const verses: Verse[] = await window.api.lookupVerse(book, chapter, verseStart, verseEnd)

      if (verses.length === 0) {
        setError(`No verses found for "${ref}"`)
        setLoading(false)
        return
      }

      const displayRef = verseEnd
        ? `${verses[0].book} ${chapter}:${verseStart}-${verseEnd}`
        : `${verses[0].book} ${chapter}:${verseStart}`

      const content: DisplayContent = { reference: displayRef, verses }
      setContent(content, verses[0].book, chapter, verseStart)

      if (displayVisible) {
        await window.api.updateDisplay(content)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }, [input, setContent, selectedMonitor, displayVisible])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-400">Verse Reference</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., John 3:16 or Psalms 23:1-6"
          className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-4 py-2.5 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !input.trim()}
          className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Loading...' : 'Show'}
        </button>
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  )
}
