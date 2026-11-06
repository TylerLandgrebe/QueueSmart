import db from '../db/database.js'

export function validateProfile(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return 'A profile is required'
    if (typeof input.fullName !== 'string' || !input.fullName.trim() || input.fullName.trim().length > 150) {
        return 'Full name must be between 1 and 150 characters'
    }
    if (input.contactInfo !== undefined && input.contactInfo !== null && (
        typeof input.contactInfo !== 'string' || input.contactInfo.trim().length > 100
    )) return 'Contact information must be 100 characters or fewer'
    return null
}

export function getProfile(userId) {
    return db.prepare(`
        SELECT p.full_name AS fullName, u.email, p.contact_info AS contactInfo
        FROM user_profiles p JOIN user_credentials u ON u.user_id = p.user_id
        WHERE p.user_id = ?
    `).get(userId) ?? null
}

export function saveProfile(userId, { fullName, contactInfo }) {
    db.prepare(`
        INSERT INTO user_profiles (user_id, full_name, contact_info) VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET full_name = excluded.full_name, contact_info = excluded.contact_info
    `).run(userId, fullName.trim(), contactInfo?.trim() || null)
    return getProfile(userId)
}
