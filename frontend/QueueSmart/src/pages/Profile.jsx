import { useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'
import NavigationBar from '../components/NavigationBar.jsx'
import './admin/AdminPages.css'

export default function Profile() {
    const { user, profile, setProfile } = useAuth()
    const [fullName, setFullName] = useState(profile?.fullName ?? '')
    const [contactInfo, setContactInfo] = useState(profile?.contactInfo ?? '')
    const [saving, setSaving] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    async function save(event) {
        event.preventDefault()
        if (saving) return
        setSaving(true)
        setMessage('')
        setError('')
        try {
            const response = await fetch('http://localhost:3000/api/auth/profile', {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fullName, contactInfo })
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Could not save your profile.')
            setProfile(data.profile)
            setFullName(data.profile.fullName)
            setContactInfo(data.profile.contactInfo ?? '')
            setMessage('Profile saved.')
        } catch (error) {
            setError(error.message)
        } finally {
            setSaving(false)
        }
    }

    return <>
        <NavigationBar userType={user.role} />
        <main className="admin-page">
            <div className="admin-content">
                <h1>Your profile</h1>
                <form className="service-form service-form-fields" onSubmit={save}>
                    <label htmlFor="profile-email">Email</label>
                    <input id="profile-email" type="text" value={user.username} readOnly />
                    <label htmlFor="profile-name">Full name</label>
                    <input id="profile-name" type="text" autoComplete="name" value={fullName}
                        onChange={event => setFullName(event.target.value)} maxLength={150} required disabled={saving} />
                    <label htmlFor="profile-contact">Contact information (optional)</label>
                    <input id="profile-contact" type="text" value={contactInfo}
                        onChange={event => setContactInfo(event.target.value)} maxLength={100} disabled={saving} />
                    {error && <p role="alert">{error}</p>}
                    {message && <p role="status">{message}</p>}
                    <div className="form-actions">
                        <button className="admin-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
                    </div>
                </form>
            </div>
        </main>
    </>
}
