# QueueSmart
Many organizations (student service centers, clinics, advising offices, help desks) struggle with long queues and poor visibility into wait times. Users often do not know how long they will wait, and staff have limited tools to manage demand efficiently.  Your team will design QueueSmart.

## Run locally

In one terminal:

```sh
cd server
npm ci
npm start
```

In a second terminal:

```sh
cd frontend/QueueSmart
npm ci
npm run dev -- --port 5173 --strictPort
```

Open http://localhost:5173. The backend listens on port 3000. SQLite initializes
automatically in `server/data/queuesmart.sqlite`; keep this file to retain saved
data. `QUEUESMART_DB_PATH` can select a different database file.

Seeded logins: `admin@email.com` / `adminPass` and
`user@email.com` / `Password123`. Use separate browser profiles or a private
window to test both roles simultaneously.

New registrations require `username` (email), `password` (at least 8 characters,
at most 72 UTF-8 bytes), and `fullName` (1–150 characters). `contactInfo` is
optional (up to 100 characters). Existing accounts can add or edit their profile
through the profile menu. Email and role cannot be edited through the profile API.
Preferences are optional and currently retain the schema default `{}`.

## Verify

```sh
cd server
npm test
npm run test:coverage
```

Tests use isolated databases, including a temporary file reopened in a fresh
process to check persistence. Coverage is available at `server/coverage/index.html`.

Frontend checks (from `frontend/QueueSmart`): `npm run build` and `npm run lint`.

For a manual check, register a user with a full name and contact information,
sign in, edit the profile, and reload. Join a queue as the user; serve or remove
the entry as admin and inspect user history and notifications. Close a queue
and verify joins are blocked. Restart the backend and verify saved profile,
queue status, and history remain available.
