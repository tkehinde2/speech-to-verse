import { useState, useEffect } from 'react'
import type { DisplayContent } from './lib/types'

export default function DisplayApp() {
  const [content, setContent] = useState<DisplayContent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const cleanup = window.api.onDisplayUpdate((data) => {
      if (data) {
        setContent(data)
        setVisible(true)
      } else {
        setVisible(false)
        setTimeout(() => setContent(null), 500)
      }
    })
    return cleanup
  }, [])

  return (
    <div className="w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none cursor-none">
      <div
        className={`flex flex-col items-center justify-center w-full h-full px-16 py-12 transition-opacity duration-500 ${
          visible && content ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {content && (
          <>
            <div className="flex-1 flex items-center justify-center w-full">
              <div className="text-center space-y-4 max-w-[85%]">
                {content.verses.map((v) => (
                  <p key={`${v.chapter}-${v.verse}`} className="text-white leading-relaxed">
                    {content.verses.length > 1 && (
                      <span className="text-amber-400 font-bold text-[2.5vw] mr-2">
                        {v.verse}
                      </span>
                    )}
                    <span className="text-[3.5vw] font-semibold">{v.text}</span>
                  </p>
                ))}
              </div>
            </div>
            <div className="mt-8">
              <p className="text-zinc-400 text-[1.8vw] italic">{content.reference}</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
