import { users } from '../data/usersData.js'


// verify taht the request belongs to a logged in user 
export function requireAuth(req, res, next) {
    const userId = req.session?.userId

    if (!userId) {
        return res.status(401).json({
            error: "Authentication required"
        })
    }

    const user = users.find(user => user.id === userId)

    if(!user) { 
        return res.status(401).json({
            error: "Invalid session"
        })
    }

    //Attach the verified user to the request
    req.user = user 

    next()
}

// Verify that the authenticated user is an admin
export function requireAdmin(req, res, next) { 
    if (req.user?.role !== 'admin') { 
        return res.status(403).json({
            error: "Admin acces required"
        })
    }

    next()
}
