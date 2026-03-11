export interface Verse {
  book: string
  chapter: number
  verse: number
  text: string
}

export interface DisplayContent {
  reference: string
  verses: Verse[]
}

export interface MonitorInfo {
  id: number
  name: string
  width: number
  height: number
  x: number
  y: number
  isPrimary: boolean
}

export interface ElectronAPI {
  lookupVerse: (
    book: string,
    chapter: number,
    verseStart: number,
    verseEnd?: number
  ) => Promise<Verse[]>
  searchBooks: (query: string) => Promise<string[]>
  getAllBooks: () => Promise<{ id: number; name: string }[]>
  navigateVerse: (
    book: string,
    chapter: number,
    verse: number,
    direction: 'next' | 'prev'
  ) => Promise<Verse[] | null>
  getMaxVerse: (book: string, chapter: number) => Promise<number>
  getMaxChapter: (book: string) => Promise<number>

  showDisplay: (monitorIndex: number) => Promise<void>
  updateDisplay: (content: DisplayContent | null) => Promise<void>
  hideDisplay: () => Promise<void>
  clearDisplay: () => Promise<void>

  getMonitors: () => Promise<MonitorInfo[]>

  onDisplayUpdate: (callback: (content: DisplayContent | null) => void) => () => void
}
