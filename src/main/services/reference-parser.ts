const BOOK_ALIASES: Record<string, string> = {
  genesis: 'Genesis', gen: 'Genesis',
  exodus: 'Exodus', exod: 'Exodus', exo: 'Exodus',
  leviticus: 'Leviticus', lev: 'Leviticus',
  numbers: 'Numbers', num: 'Numbers',
  deuteronomy: 'Deuteronomy', deut: 'Deuteronomy',
  joshua: 'Joshua', josh: 'Joshua',
  judges: 'Judges', judg: 'Judges',
  ruth: 'Ruth',
  samuel: 'Samuel', sam: 'Samuel',
  kings: 'Kings', kgs: 'Kings',
  chronicles: 'Chronicles', chron: 'Chronicles', chr: 'Chronicles',
  ezra: 'Ezra',
  nehemiah: 'Nehemiah', neh: 'Nehemiah',
  esther: 'Esther', est: 'Esther',
  job: 'Job',
  psalm: 'Psalms', psalms: 'Psalms', ps: 'Psalms',
  proverbs: 'Proverbs', prov: 'Proverbs', pro: 'Proverbs',
  ecclesiastes: 'Ecclesiastes', eccl: 'Ecclesiastes', ecc: 'Ecclesiastes',
  'song of solomon': 'Song of Solomon', 'song of songs': 'Song of Solomon',
  solomon: 'Song of Solomon', canticles: 'Song of Solomon', song: 'Song of Solomon',
  isaiah: 'Isaiah', isa: 'Isaiah',
  jeremiah: 'Jeremiah', jer: 'Jeremiah',
  lamentations: 'Lamentations', lam: 'Lamentations',
  ezekiel: 'Ezekiel', ezek: 'Ezekiel', eze: 'Ezekiel',
  daniel: 'Daniel', dan: 'Daniel',
  hosea: 'Hosea', hos: 'Hosea',
  joel: 'Joel',
  amos: 'Amos',
  obadiah: 'Obadiah', obad: 'Obadiah',
  jonah: 'Jonah', jon: 'Jonah',
  micah: 'Micah', mic: 'Micah',
  nahum: 'Nahum', nah: 'Nahum',
  habakkuk: 'Habakkuk', hab: 'Habakkuk',
  zephaniah: 'Zephaniah', zeph: 'Zephaniah',
  haggai: 'Haggai', hag: 'Haggai',
  zechariah: 'Zechariah', zech: 'Zechariah',
  malachi: 'Malachi', mal: 'Malachi',
  matthew: 'Matthew', matt: 'Matthew', mat: 'Matthew',
  mark: 'Mark', mrk: 'Mark',
  luke: 'Luke', luk: 'Luke',
  john: 'John', jhn: 'John',
  acts: 'Acts', 'acts of the apostles': 'Acts',
  romans: 'Romans', rom: 'Romans',
  corinthians: 'Corinthians', cor: 'Corinthians',
  galatians: 'Galatians', gal: 'Galatians',
  ephesians: 'Ephesians', eph: 'Ephesians',
  philippians: 'Philippians', phil: 'Philippians', php: 'Philippians',
  colossians: 'Colossians', col: 'Colossians',
  thessalonians: 'Thessalonians', thess: 'Thessalonians',
  timothy: 'Timothy', tim: 'Timothy',
  titus: 'Titus', tit: 'Titus',
  philemon: 'Philemon', phlm: 'Philemon', phm: 'Philemon',
  hebrews: 'Hebrews', heb: 'Hebrews',
  james: 'James', jas: 'James',
  peter: 'Peter', pet: 'Peter',
  jude: 'Jude',
  revelation: 'Revelation', revelations: 'Revelation', rev: 'Revelation',
  apocalypse: 'Revelation'
}

const BOOK_PREFIXES: Record<string, string> = {
  first: '1', '1st': '1', one: '1',
  second: '2', '2nd': '2', two: '2',
  third: '3', '3rd': '3', three: '3'
}

const NUM_WORDS: Record<string, number> = {
  zero: 0, oh: 0,
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  hundred: 100
}

const RANGE_WORDS = new Set(['to', 'through', 'thru', 'dash', 'minus'])

function wordsToNumber(tokens: string[]): [number, number] {
  if (tokens.length === 0) throw new Error('Missing number')

  if (/^\d+$/.test(tokens[0])) {
    return [parseInt(tokens[0], 10), 1]
  }

  let current = 0
  let used = 0

  for (const t of tokens) {
    if (/^\d+$/.test(t)) break
    if (!(t in NUM_WORDS)) break
    used++
    const val = NUM_WORDS[t]
    if (val === 100) {
      current = Math.max(1, current) * 100
    } else {
      current += val
    }
  }

  if (used === 0) throw new Error('No number words found')
  return [current, used]
}

function normalizeBook(bookTokens: string[]): string {
  const key = bookTokens.join(' ').toLowerCase().trim().replace(/\s+/g, ' ')
  const mapped = BOOK_ALIASES[key]
  if (mapped) return mapped
  return bookTokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()).join(' ')
}

export function normalizeReference(spoken: string): string {
  let s = spoken.toLowerCase()
  s = s.replace(/[^\w\s:-]/g, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/chapter/g, ' chapter ').replace(/verse/g, ' verse ')
  s = s.replace(/\s+/g, ' ').trim()

  const tokens = s.split(' ')
  if (tokens.length === 0) throw new Error('Empty speech')

  let prefix: string | null = null
  let i = 0

  if (tokens[0] in BOOK_PREFIXES) {
    prefix = BOOK_PREFIXES[tokens[0]]
    i = 1
    if (i >= tokens.length) throw new Error('Missing book after prefix')
  }

  const bookTokens: string[] = []
  while (i < tokens.length) {
    if (/^\d+$/.test(tokens[i]) || tokens[i] in NUM_WORDS || tokens[i] === 'chapter' || tokens[i] === 'verse') {
      break
    }
    bookTokens.push(tokens[i])
    i++
  }

  if (bookTokens.length === 0) throw new Error('Could not find book name')

  let book = normalizeBook(bookTokens)
  if (prefix) book = `${prefix} ${book}`

  if (i < tokens.length && tokens[i] === 'chapter') i++

  const [chapter, chUsed] = wordsToNumber(tokens.slice(i))
  i += chUsed

  if (i < tokens.length && tokens[i] === 'verse') i++

  const [verseStart, vsUsed] = wordsToNumber(tokens.slice(i))
  i += vsUsed

  let verseEnd: number | null = null
  if (i < tokens.length && RANGE_WORDS.has(tokens[i])) {
    i++
    if (i < tokens.length && tokens[i] === 'verse') i++
    const [ve, veUsed] = wordsToNumber(tokens.slice(i))
    verseEnd = ve
    i += veUsed
  }

  if (verseEnd !== null) {
    return `${book} ${chapter}:${verseStart}-${verseEnd}`
  }
  return `${book} ${chapter}:${verseStart}`
}

export interface ParsedReference {
  book: string
  chapter: number
  verseStart: number
  verseEnd?: number
}

export function parseReference(input: string): ParsedReference {
  const s = input.trim()

  const match = s.match(/^(.+?)\s+(\d+):(\d+)(?:\s*-\s*(\d+))?$/)
  if (match) {
    return {
      book: match[1].trim(),
      chapter: parseInt(match[2], 10),
      verseStart: parseInt(match[3], 10),
      verseEnd: match[4] ? parseInt(match[4], 10) : undefined
    }
  }

  try {
    const normalized = normalizeReference(s)
    return parseReference(normalized)
  } catch {
    throw new Error(`Could not parse reference: "${input}"`)
  }
}

const VOICE_COMMANDS: Record<string, string> = {
  'next verse': 'next',
  next: 'next',
  'next one': 'next',
  'go forward': 'next',
  'last verse': 'prev',
  'previous verse': 'prev',
  previous: 'prev',
  'go back': 'prev',
  back: 'prev',
  clear: 'clear',
  'clear screen': 'clear',
  blank: 'clear',
  'blank screen': 'clear',
  hide: 'clear'
}

export function detectVoiceCommand(text: string): string | null {
  const normalized = text.toLowerCase().trim()
  return VOICE_COMMANDS[normalized] ?? null
}
