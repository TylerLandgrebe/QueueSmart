import { randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'

const userHashedPassword = await bcrypt.hash("Password123", 10)
const adminHashedPassword = await bcrypt.hash("adminPass", 10)

// username should be valid email
const users = [
    {
        id: randomUUID(),
        username: "user@email.com",
        passwordHash: userHashedPassword,
        role: "user"
    },
    {
        id: randomUUID(),
        username: "admin@email.com",
        passwordHash: adminHashedPassword,
        role: "admin"
    }
]

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
    users,
    verifyRegister
}