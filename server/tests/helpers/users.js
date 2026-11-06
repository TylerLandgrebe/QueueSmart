import db from '../../src/db/database.js'
import { createUser } from '../../src/data/usersData.js'

// Replace every row in user_credentials with the given users
export function resetUsers(users = []) {
    const reset = db.transaction(() => {
        db.prepare('DELETE FROM user_credentials').run()
        for (const user of users) createUser(user)
    })

    reset()
}

// Read back every stored user in the app's user shape
export function getAllUsers() {
    return db.prepare(`
        SELECT user_id AS id, email AS username, password_hash AS passwordHash, role
        FROM user_credentials
        ORDER BY rowid
    `).all()
}
