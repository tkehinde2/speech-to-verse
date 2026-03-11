import { contextBridge, ipcRenderer } from 'electron'

const api = {
  lookupVerse: (book: string, chapter: number, verseStart: number, verseEnd?: number) =>
    ipcRenderer.invoke('bible:lookup', book, chapter, verseStart, verseEnd),

  searchBooks: (query: string) =>
    ipcRenderer.invoke('bible:search-books', query),

  getAllBooks: () =>
    ipcRenderer.invoke('bible:all-books'),

  navigateVerse: (book: string, chapter: number, verse: number, direction: 'next' | 'prev') =>
    ipcRenderer.invoke('bible:navigate', book, chapter, verse, direction),

  getMaxVerse: (book: string, chapter: number) =>
    ipcRenderer.invoke('bible:max-verse', book, chapter),

  getMaxChapter: (book: string) =>
    ipcRenderer.invoke('bible:max-chapter', book),

  showDisplay: (monitorIndex: number) =>
    ipcRenderer.invoke('display:show', monitorIndex),

  updateDisplay: (content: unknown) =>
    ipcRenderer.invoke('display:update', content),

  hideDisplay: () =>
    ipcRenderer.invoke('display:hide'),

  clearDisplay: () =>
    ipcRenderer.invoke('display:clear'),

  getMonitors: () =>
    ipcRenderer.invoke('monitors:list'),

  onDisplayUpdate: (callback: (content: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, content: unknown): void => {
      callback(content)
    }
    ipcRenderer.on('display:content', handler)
    return () => {
      ipcRenderer.removeListener('display:content', handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
