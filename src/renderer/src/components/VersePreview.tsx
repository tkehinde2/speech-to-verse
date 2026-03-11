import { useCallback } from 'react'
import { useVerseStore } from '../stores/verseStore'
import type { DisplayContent, Verse } from '../lib/types'

export default function VersePreview() {
  const {
    currentContent,
    currentBook,
    currentChapter,
    currentVerse,
    setContent,
    clearContent,
    selectedMonitor,
    displayVisible,
    setDisplayVisible
  } = useVerseStore()

  const sendToDisplay = useCallback(async () => {
    if (!displayVisible) {
      await window.api.showDisplay(selectedMonitor)
      setDisplayVisible(true)
      if (currentContent) {
        setTimeout(() => window.api.updateDisplay(currentContent), 500)
      }
    } else if (currentContent) {
      await window.api.updateDisplay(currentContent)
    }
  }, [currentContent, selectedMonitor, displayVisible, setDisplayVisible])

  const hideDisplay = useCallback(async () => {
    await window.api.hideDisplay()
    setDisplayVisible(false)
  }, [setDisplayVisible])

  const clearDisplay = useCallback(async () => {
    await window.api.clearDisplay()
    clearContent()
  }, [clearContent])

  const navigate = useCallback(
    async (direction: 'next' | 'prev') => {
      if (!currentBook) return

      const verses: Verse[] | null = await window.api.navigateVerse(
        currentBook,
        currentChapter,
        currentVerse,
        direction
      )
      if (!verses || verses.length === 0) return

      const v = verses[0]
      const content: DisplayContent = {
        reference: `${v.book} ${v.chapter}:${v.verse}`,
        verses
      }
      setContent(content, v.book, v.chapter, v.verse)

      if (displayVisible) {
        await window.api.updateDisplay(content)
      }
    },
    [currentBook, currentChapter, currentVerse, setContent, displayVisible]
  )

  return (
    <div className="flex-1 flex flex-col rounded-xl border border-zinc-700 overflow-hidden">
      <div className="flex items-center justify-between bg-zinc-800 px-4 py-2.5 border-b border-zinc-700">
        <span className="text-sm font-medium text-zinc-400">Live Preview</span>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('prev')}
            disabled={!currentContent}
            className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded transition-colors"
            title="Previous verse"
          >
            Prev
          </button>
          <button
            onClick={() => navigate('next')}
            disabled={!currentContent}
            className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 rounded transition-colors"
            title="Next verse"
          >
            Next
          </button>
          <div className="w-px bg-zinc-600" />
          <button
            onClick={sendToDisplay}
            className="px-3 py-1 text-xs bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors"
          >
            {displayVisible ? 'Update Display' : 'Show Display'}
          </button>
          {displayVisible && (
            <>
              <button
                onClick={clearDisplay}
                className="px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
              >
                Clear
              </button>
              <button
                onClick={hideDisplay}
                className="px-3 py-1 text-xs bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
              >
                Hide
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 bg-black flex items-center justify-center p-8 min-h-[300px]">
        {currentContent ? (
          <div className="text-center space-y-3 max-w-2xl">
            {currentContent.verses.map((v) => (
              <p key={`${v.chapter}-${v.verse}`} className="text-white leading-relaxed">
                {currentContent.verses.length > 1 && (
                  <span className="text-amber-400 font-bold text-lg mr-1.5">{v.verse}</span>
                )}
                <span className="text-xl font-semibold">{v.text}</span>
              </p>
            ))}
            <p className="text-zinc-500 text-sm italic mt-4">{currentContent.reference}</p>
          </div>
        ) : (
          <p className="text-zinc-600 text-sm">Search for a verse to preview it here</p>
        )}
      </div>
    </div>
  )
}
