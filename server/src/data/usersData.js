import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import db from '../db/database.js'

// Default accounts seeded on startup (username should be a valid email)
const seedUsers = [
    { username: "user@email.com", password: "Password123", role: "user" },
    { username: "admin@email.com", password: "adminPass", role: "admin" }
]

// Map a user_credentials row to the shape the rest of the app expects
function toUser(row) {
    if (!row) return null

    return {
        id: row.user_id,
        username: row.email,
        passwordHash: row.password_hash,
        role: row.role
    }
}

const selectUserByUsername = db.prepare(`
    SELECT user_id, email, password_hash, role
    FROM user_credentials
    WHERE email = ?
`)

const selectUserById = db.prepare(`
    SELECT user_id, email, password_hash, role
    FROM user_credentials
    WHERE user_id = ?
`)

const insertUser = db.prepare(`
    INSERT INTO user_credentials (user_id, email, password_hash, role)
    VALUES (?, ?, ?, ?)
`)

function findUserByUsername(username) {
    return toUser(selectUserByUsername.get(username))
}

function findUserById(id) {
    return toUser(selectUserById.get(id))
}

// Persist a user whose password has already been hashed.
// Throws a SQLITE_CONSTRAINT_UNIQUE error if the username is taken.
function createUser({ id = randomUUID(), username, passwordHash, role = 'user' }) {
    insertUser.run(id, username, passwordHash, role)
    return { id, username, passwordHash, role }
}

function isDuplicateUserError(error) {
    return error?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY'
}

// Only hash and insert seed accounts that are missing from the database
for (const seed of seedUsers) {
    if (!findUserByUsername(seed.username)) {
        createUser({
            username: seed.username,
            passwordHash: await bcrypt.hash(seed.password, 10),
            role: seed.role
        })
    }
}

// Check that email is valid format
// Check that password is at least length of 8 characters
function verifyRegister(username, password){
    if (typeof username !== "string" || password.length < 8){
        return "invalid password"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(typeof password !== "string" || !emailRegex.test(username)){
        return "invalid email"
    }

    return 'valid'
}

export {
    findUserByUsername,
    findUserById,
    createUser,
    isDuplicateUserError,
    verifyRegister
}
