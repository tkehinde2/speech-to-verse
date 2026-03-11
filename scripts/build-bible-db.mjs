import { createRequire } from 'module'
import { mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const require = createRequire(import.meta.url)
const Database = require('better-sqlite3')

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'resources', 'bible.db')

const KJV_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json'

const STANDARD_NAMES = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy',
  'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
  '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles',
  'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
  'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations',
  'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk',
  'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  'Matthew', 'Mark', 'Luke', 'John', 'Acts',
  'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
  'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians',
  '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
  'James', '1 Peter', '2 Peter', '1 John', '2 John',
  '3 John', 'Jude', 'Revelation'
]

async function main() {
  console.log('Fetching KJV Bible data...')
  const response = await fetch(KJV_URL)
  if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`)

  const books = await response.json()
  console.log(`Got ${books.length} books`)

  const resourcesDir = join(__dirname, '..', 'resources')
  if (!existsSync(resourcesDir)) {
    mkdirSync(resourcesDir, { recursive: true })
  }

  if (existsSync(DB_PATH)) {
    const { unlinkSync } = await import('fs')
    unlinkSync(DB_PATH)
  }

  const db = new Database(DB_PATH)

  db.exec(`
    CREATE TABLE books (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      testament TEXT NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `)

  db.exec(`CREATE INDEX idx_verses_lookup ON verses(book_id, chapter, verse)`)
  db.exec(`CREATE INDEX idx_books_name ON books(name)`)

  const insertBook = db.prepare('INSERT INTO books (id, name, testament) VALUES (?, ?, ?)')
  const insertVerse = db.prepare('INSERT INTO verses (book_id, chapter, verse, text) VALUES (?, ?, ?, ?)')

  let totalVerses = 0

  const transaction = db.transaction(() => {
    for (let i = 0; i < books.length; i++) {
      const book = books[i]
      const testament = i < 39 ? 'OT' : 'NT'
      const bookName = STANDARD_NAMES[i] || book.name || `Book ${i + 1}`

      insertBook.run(i + 1, bookName, testament)

      const chapters = book.chapters
      for (let ch = 0; ch < chapters.length; ch++) {
        const verses = chapters[ch]
        for (let v = 0; v < verses.length; v++) {
          const text = (verses[v] || '').trim()
          if (text) {
            insertVerse.run(i + 1, ch + 1, v + 1, text)
            totalVerses++
          }
        }
      }
    }
  })

  transaction()
  db.close()

  console.log(`Bible database created: ${DB_PATH}`)
  console.log(`  ${books.length} books, ${totalVerses} verses`)
}

main().catch((err) => {
  console.error('Failed to build Bible database:', err)
  process.exit(1)
})
