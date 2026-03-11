import { app, BrowserWindow, ipcMain, screen, session } from 'electron'
import { join } from 'path'
import { initBibleDB, lookupVerses, searchBooks, getAllBooks, navigateVerse, getMaxVerse, getMaxChapter } from './services/bible-db'

let controlWindow: BrowserWindow | null = null
let displayWindow: BrowserWindow | null = null

function createControlWindow(): void {
  controlWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    title: 'Speech to Verse',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    controlWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    controlWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  controlWindow.on('closed', () => {
    controlWindow = null
    if (displayWindow) {
      displayWindow.close()
      displayWindow = null
    }
    app.quit()
  })
}

function createDisplayWindow(monitorIndex: number): void {
  const displays = screen.getAllDisplays()
  const idx = Math.max(0, Math.min(monitorIndex, displays.length - 1))
  const display = displays[idx]

  if (displayWindow) {
    displayWindow.close()
  }

  displayWindow = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    frame: false,
    fullscreen: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    displayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/display.html`)
  } else {
    displayWindow.loadFile(join(__dirname, '../renderer/display.html'))
  }

  displayWindow.on('closed', () => {
    displayWindow = null
  })
}

function registerIpcHandlers(): void {
  ipcMain.handle('bible:lookup', (_event, book: string, chapter: number, verseStart: number, verseEnd?: number) => {
    return lookupVerses(book, chapter, verseStart, verseEnd)
  })

  ipcMain.handle('bible:search-books', (_event, query: string) => {
    return searchBooks(query)
  })

  ipcMain.handle('bible:all-books', () => {
    return getAllBooks()
  })

  ipcMain.handle('bible:navigate', (_event, book: string, chapter: number, verse: number, direction: 'next' | 'prev') => {
    return navigateVerse(book, chapter, verse, direction)
  })

  ipcMain.handle('bible:max-verse', (_event, book: string, chapter: number) => {
    return getMaxVerse(book, chapter)
  })

  ipcMain.handle('bible:max-chapter', (_event, book: string) => {
    return getMaxChapter(book)
  })

  ipcMain.handle('display:show', (_event, monitorIndex: number) => {
    createDisplayWindow(monitorIndex)
  })

  ipcMain.handle('display:update', (_event, content) => {
    if (displayWindow) {
      displayWindow.webContents.send('display:content', content)
    }
  })

  ipcMain.handle('display:hide', () => {
    if (displayWindow) {
      displayWindow.close()
      displayWindow = null
    }
  })

  ipcMain.handle('display:clear', () => {
    if (displayWindow) {
      displayWindow.webContents.send('display:content', null)
    }
  })

  ipcMain.handle('monitors:list', () => {
    const displays = screen.getAllDisplays()
    const primary = screen.getPrimaryDisplay()
    return displays.map((d, i) => ({
      id: i,
      name: `Display ${i + 1}${d.id === primary.id ? ' (Primary)' : ''}`,
      width: d.bounds.width,
      height: d.bounds.height,
      x: d.bounds.x,
      y: d.bounds.y,
      isPrimary: d.id === primary.id
    }))
  })
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true)
      return
    }
    callback(false)
  })

  await initBibleDB()
  registerIpcHandlers()
  createControlWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})
