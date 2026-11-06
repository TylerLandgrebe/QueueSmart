import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Each test file runs in its own worker, so each gets a fresh
        // in-memory database instead of touching data/queuesmart.sqlite
        env: {
            QUEUESMART_DB_PATH: ':memory:'
        }
    }
})
