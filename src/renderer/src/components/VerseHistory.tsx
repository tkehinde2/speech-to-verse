import { useCallback } from 'react'
import { useVerseStore } from '../stores/verseStore'

export default function VerseHistory() {
  const { history, setContent, displayVisible } = useVerseStore()

  const selectHistoryItem = useCallback(
    async (index: number) => {
      const item = history[index]
      if (!item) return

      const v = item.verses[0]
      setContent(item, v.book, v.chapter, v.verse)

      if (displayVisible) {
        await window.api.updateDisplay(item)
      }
    },
    [history, setContent, displayVisible]
  )

  return (
    <div className="flex flex-col h-full">
      <h3 className="text-sm font-medium text-zinc-400 mb-2">History</h3>
      {history.length === 0 ? (
        <p className="text-zinc-600 text-xs">No verses displayed yet</p>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {history.map((item, i) => (
            <button
              key={`${item.reference}-${i}`}
              onClick={() => selectHistoryItem(i)}
              className="w-full text-left px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors group"
            >
              <p className="text-sm font-medium text-amber-400 group-hover:text-amber-300">
                {item.reference}
              </p>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                {item.verses.map((v) => v.text).join(' ')}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
