const { randomUUID } = require('node: crypto')

// username should be valid email
const users = [
    {
        id: randomUUID(),
        username: "user@email.com",
        passwordHash: "Password123",
        role: "user"
    },
    {
        id: randomUUID(),
        username: "admin@email.com",
        passwordHash: "adminPass",
        role: "admin"
    }
]

// Check that email is valid format
// Check that password is at least length of 8 characters
function verifyRegister(username, password){
    if (length(password) < 8){
        return "invalid password"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
        return "invalid email"
    }

    return 'valid'
}

module.exports = {
    users, 
    verifyRegister
}