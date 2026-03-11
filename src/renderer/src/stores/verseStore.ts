import { create } from 'zustand'
import type { Verse, DisplayContent, MonitorInfo } from '../lib/types'

interface VerseStore {
  currentContent: DisplayContent | null
  currentBook: string
  currentChapter: number
  currentVerse: number
  history: DisplayContent[]
  monitors: MonitorInfo[]
  selectedMonitor: number
  displayVisible: boolean

  isListening: boolean
  whisperStatus: string
  whisperLoaded: boolean
  lastHeard: string
  selectedMicId: string

  setContent: (content: DisplayContent, book: string, chapter: number, verse: number) => void
  clearContent: () => void
  addToHistory: (content: DisplayContent) => void
  setMonitors: (monitors: MonitorInfo[]) => void
  selectMonitor: (index: number) => void
  setDisplayVisible: (visible: boolean) => void

  setListening: (listening: boolean) => void
  setWhisperStatus: (status: string) => void
  setWhisperLoaded: (loaded: boolean) => void
  setLastHeard: (text: string) => void
  setSelectedMicId: (id: string) => void
}

export const useVerseStore = create<VerseStore>((set) => ({
  currentContent: null,
  currentBook: '',
  currentChapter: 0,
  currentVerse: 0,
  history: [],
  monitors: [],
  selectedMonitor: 0,
  displayVisible: false,

  isListening: false,
  whisperStatus: 'Not loaded',
  whisperLoaded: false,
  lastHeard: '',
  selectedMicId: '',

  setContent: (content, book, chapter, verse) =>
    set((state) => ({
      currentContent: content,
      currentBook: book,
      currentChapter: chapter,
      currentVerse: verse,
      history: [content, ...state.history.filter((h) => h.reference !== content.reference)].slice(0, 20)
    })),

  clearContent: () => set({ currentContent: null }),

  addToHistory: (content) =>
    set((state) => ({
      history: [content, ...state.history.filter((h) => h.reference !== content.reference)].slice(0, 20)
    })),

  setMonitors: (monitors) => set({ monitors }),
  selectMonitor: (index) => set({ selectedMonitor: index }),
  setDisplayVisible: (visible) => set({ displayVisible: visible }),

  setListening: (listening) => set({ isListening: listening }),
  setWhisperStatus: (status) => set({ whisperStatus: status }),
  setWhisperLoaded: (loaded) => set({ whisperLoaded: loaded }),
  setLastHeard: (text) => set({ lastHeard: text }),
  setSelectedMicId: (id) => set({ selectedMicId: id })
}))
