// username should be valid email
export const users = [
    {
        username: "user@email.com",
        passwordHash: "Password123",
        role: "user"
    },
    {
        username: "admin@email.com",
        passwordHash: "adminPass",
        role: "admin"
    }
]

// Check that email is valid format
// Check that password is at least length of 8 characters
export function verifyRegister(username, password){
    if (length(password) < 8){
        return "invalid password"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email)){
        return "invalid email"
    }

    return 'valid'
}