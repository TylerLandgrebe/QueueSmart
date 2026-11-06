import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// QUEUESMART_DB_PATH lets tests use an isolated database (e.g. ':memory:')
const databasePath = process.env.QUEUESMART_DB_PATH || fileURLToPath(
    new URL('../../data/queuesmart.sqlite', import.meta.url)
)

if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true })
}

const db = new Database(databasePath)

db.pragma('foreign_keys = ON')

const schema = readFileSync(
    new URL('./schema.sql', import.meta.url),
    'utf8'
)

db.exec(schema)

export default db