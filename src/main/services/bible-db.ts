import { readFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'

let db: SqlJsDatabase | null = null

export async function initBibleDB(): Promise<void> {
  const dbPath = app.isPackaged
    ? join(process.resourcesPath, 'bible.db')
    : join(__dirname, '../../resources/bible.db')

  const SQL = await initSqlJs()
  const buffer = readFileSync(dbPath)
  db = new SQL.Database(buffer)
}

function getDB(): SqlJsDatabase {
  if (!db) throw new Error('Bible DB not initialized')
  return db
}

export interface VerseRow {
  book: string
  chapter: number
  verse: number
  text: string
}

function queryAll(sql: string, params: unknown[]): Record<string, unknown>[] {
  const d = getDB()
  const stmt = d.prepare(sql)
  stmt.bind(params)
  const results: Record<string, unknown>[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function queryOne(sql: string, params: unknown[]): Record<string, unknown> | undefined {
  const rows = queryAll(sql, params)
  return rows[0]
}

export function lookupVerses(
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd?: number
): VerseRow[] {
  const end = verseEnd ?? verseStart
  return queryAll(
    `SELECT b.name as book, v.chapter, v.verse, v.text
     FROM verses v
     JOIN books b ON v.book_id = b.id
     WHERE LOWER(b.name) = LOWER(?) AND v.chapter = ? AND v.verse BETWEEN ? AND ?
     ORDER BY v.verse`,
    [book, chapter, verseStart, end]
  ) as unknown as VerseRow[]
}

export function searchBooks(query: string): string[] {
  const rows = queryAll(
    `SELECT name FROM books WHERE LOWER(name) LIKE LOWER(?) ORDER BY id`,
    [`%${query}%`]
  )
  return rows.map((r) => r.name as string)
}

export function getAllBooks(): { id: number; name: string }[] {
  return queryAll(
    `SELECT id, name FROM books ORDER BY id`,
    []
  ) as unknown as { id: number; name: string }[]
}

export function getMaxVerse(book: string, chapter: number): number {
  const row = queryOne(
    `SELECT MAX(v.verse) as max_verse
     FROM verses v
     JOIN books b ON v.book_id = b.id
     WHERE LOWER(b.name) = LOWER(?) AND v.chapter = ?`,
    [book, chapter]
  )
  return (row?.max_verse as number) ?? 0
}

export function getMaxChapter(book: string): number {
  const row = queryOne(
    `SELECT MAX(v.chapter) as max_chapter
     FROM verses v
     JOIN books b ON v.book_id = b.id
     WHERE LOWER(b.name) = LOWER(?)`,
    [book]
  )
  return (row?.max_chapter as number) ?? 0
}

export function navigateVerse(
  book: string,
  chapter: number,
  verse: number,
  direction: 'next' | 'prev'
): VerseRow[] | null {
  if (direction === 'next') {
    let result = lookupVerses(book, chapter, verse + 1, verse + 1)
    if (result.length > 0) return result

    result = lookupVerses(book, chapter + 1, 1, 1)
    if (result.length > 0) return result

    const nextBook = queryOne(
      `SELECT b2.name FROM books b1
       JOIN books b2 ON b2.id = b1.id + 1
       WHERE LOWER(b1.name) = LOWER(?)`,
      [book]
    )
    if (nextBook) {
      result = lookupVerses(nextBook.name as string, 1, 1, 1)
      if (result.length > 0) return result
    }
  } else {
    if (verse > 1) {
      const result = lookupVerses(book, chapter, verse - 1, verse - 1)
      if (result.length > 0) return result
    }

    if (chapter > 1) {
      const mv = getMaxVerse(book, chapter - 1)
      if (mv > 0) {
        return lookupVerses(book, chapter - 1, mv, mv)
      }
    }

    const prevBook = queryOne(
      `SELECT b2.name FROM books b1
       JOIN books b2 ON b2.id = b1.id - 1
       WHERE LOWER(b1.name) = LOWER(?)`,
      [book]
    )
    if (prevBook) {
      const maxCh = getMaxChapter(prevBook.name as string)
      if (maxCh > 0) {
        const maxV = getMaxVerse(prevBook.name as string, maxCh)
        if (maxV > 0) {
          return lookupVerses(prevBook.name as string, maxCh, maxV, maxV)
        }
      }
    }
  }

  return null
}
