import { useCallback, useRef } from 'react'
import { useVerseStore } from '../stores/verseStore'
import { AudioCapture } from '../lib/audio-capture'
import type { DisplayContent, Verse } from '../lib/types'

let transcriber: any = null

async function loadWhisper(onProgress: (msg: string) => void): Promise<void> {
  const { pipeline } = await import('@huggingface/transformers')
  onProgress('Downloading Whisper model (first time only)...')

  transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: any) => {
      if (p.status === 'progress' && p.progress !== undefined) {
        onProgress(`Loading model: ${Math.round(p.progress)}%`)
      }
    }
  })
}

async function transcribeAudio(audio: Float32Array): Promise<string> {
  if (!transcriber) throw new Error('Whisper model not loaded')
  const result = await transcriber(audio, {
    language: 'english',
    task: 'transcribe'
  })
  return (result as { text: string }).text.trim()
}

export default function MicButton() {
  const {
    isListening,
    setListening,
    whisperLoaded,
    setWhisperLoaded,
    setWhisperStatus,
    setLastHeard,
    setContent,
    displayVisible,
    selectedMicId
  } = useVerseStore()

  const captureRef = useRef<AudioCapture | null>(null)
  const transcribingRef = useRef(false)

  const processUtterance = useCallback(
    async (audio: Float32Array) => {
      if (transcribingRef.current) return
      transcribingRef.current = true
      setWhisperStatus('Transcribing...')

      try {
        const text = await transcribeAudio(audio)
        if (!text || text.length < 3) {
          setWhisperStatus('Listening...')
          return
        }

        setLastHeard(text)

        const { detectVoiceCommand, parseReference } = await import(
          '../lib/reference-parser'
        )

        const command = detectVoiceCommand(text)
        if (command) {
          setWhisperStatus(`Command: ${command}`)
          const store = useVerseStore.getState()

          if (command === 'next' || command === 'prev') {
            if (store.currentBook) {
              const verses: Verse[] | null = await window.api.navigateVerse(
                store.currentBook,
                store.currentChapter,
                store.currentVerse,
                command as 'next' | 'prev'
              )
              if (verses && verses.length > 0) {
                const v = verses[0]
                const content: DisplayContent = {
                  reference: `${v.book} ${v.chapter}:${v.verse}`,
                  verses
                }
                store.setContent(content, v.book, v.chapter, v.verse)
                if (displayVisible) {
                  await window.api.updateDisplay(content)
                }
              }
            }
          } else if (command === 'clear') {
            await window.api.clearDisplay()
            useVerseStore.getState().clearContent()
          }

          setWhisperStatus('Listening...')
          return
        }

        try {
          const parsed = parseReference(text)
          const verses: Verse[] = await window.api.lookupVerse(
            parsed.book,
            parsed.chapter,
            parsed.verseStart,
            parsed.verseEnd
          )

          if (verses.length > 0) {
            const displayRef = parsed.verseEnd
              ? `${verses[0].book} ${parsed.chapter}:${parsed.verseStart}-${parsed.verseEnd}`
              : `${verses[0].book} ${parsed.chapter}:${parsed.verseStart}`

            const content: DisplayContent = { reference: displayRef, verses }
            setContent(content, verses[0].book, parsed.chapter, parsed.verseStart)
            setWhisperStatus(`Found: ${displayRef}`)

            if (displayVisible) {
              await window.api.updateDisplay(content)
            }
          } else {
            setWhisperStatus(`No verses found for: ${text}`)
          }
        } catch {
          setWhisperStatus(`Heard: "${text}" (not a verse reference)`)
        }
      } catch (err) {
        setWhisperStatus(`Error: ${err instanceof Error ? err.message : 'Transcription failed'}`)
      } finally {
        transcribingRef.current = false
        if (useVerseStore.getState().isListening) {
          setTimeout(() => setWhisperStatus('Listening...'), 2000)
        }
      }
    },
    [setContent, setLastHeard, setWhisperStatus, displayVisible]
  )

  const toggleListening = useCallback(async () => {
    if (isListening) {
      captureRef.current?.stop()
      captureRef.current = null
      setListening(false)
      setWhisperStatus('Stopped')
      return
    }

    try {
      if (!whisperLoaded) {
        await loadWhisper((msg) => setWhisperStatus(msg))
        setWhisperLoaded(true)
      }

      const capture = new AudioCapture()
      capture.onUtterance = processUtterance
      await capture.start(selectedMicId || undefined)
      captureRef.current = capture
      setListening(true)
      setWhisperStatus('Listening...')
    } catch (err) {
      setWhisperStatus(`Error: ${err instanceof Error ? err.message : 'Failed to start mic'}`)
    }
  }, [isListening, whisperLoaded, selectedMicId, setListening, setWhisperLoaded, setWhisperStatus, processUtterance])

  return (
    <button
      onClick={toggleListening}
      className={`w-full py-3 rounded-lg font-medium text-sm transition-all ${
        isListening
          ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
      }`}
    >
      {isListening ? 'Stop Listening' : 'Start Listening'}
    </button>
  )
}
