import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const databasePath = fileURLToPath(
    new URL('../../data/queuesmart.sqlite', import.meta.url)
)

mkdirSync(dirname(databasePath), { recursive: true })

const db = new Database(databasePath)

db.pragma('foreign_keys = ON')

const schema = readFileSync(
    new URL('./schema.sql', import.meta.url),
    'utf8'
)

db.exec(schema)

export default db