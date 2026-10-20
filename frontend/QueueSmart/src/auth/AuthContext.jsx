import { createContext, useContext, useEffect, useState} from 'react'


const API = "http://localhost:3000/"

// Create the "box" that holds the shared auth data
const AuthContext = createContext(null)

//  A component that fills the box and wraps the whole app
export function AuthProvider({children}){
    const [user, setUser] = useState(null) // null = not logged in
    const [loading, setLoading] = useState(true) // true until /me answers

    // Runs once when the app first laod (including after a page refresh)
    useEffect(() => {
        fetch(`${API}api/auth/me`, {credentials: 'include'})
            .then(response => (response.ok ? response.json(): null))
            .then(data => setUser(data?.user ?? null))
            .catch(() => setUser(null))
            .finally(() => setLoading(false))
    }, [])
    

    async function logout() { 
        try { 
            await fetch(`${API}api/auth/logout`, { 
                method: "POST",
                credentials: "include"
            })
        } finally {
            setUser(null)
        }
    }

    return (
        <AuthContext.Provider value={{ user, setUser, loading, logout}}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}