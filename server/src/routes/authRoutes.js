const {users, verifyRegister} = require('../data/usersData.js')
const express = require('express')
const { randomUUID } = require('node: crypto')
const bcrypt = require('bcrypt')

const router = express.Router()

router.post('/login', async (req, res) => {
    try{
        const username = typeof req.body.username === "string"
            ? req.body.username.trim().toLowerCase()
            : req.body.username
        const password = req.body.password

        // Validate required fields
        if (
            typeof username !== "string" ||
            typeof password !== "string" ||
            !username.trim() ||
            !password
        ) {
            return res.status(400).json({
                error: "Username and password are required"
            });
        }

        // Find matching user
        const user = users.find(user => user.username === username)

        if(!user){
            return res.status(401).json({
                error: "Invalid login credentials"
            })
        }
        
        //Check matching passwords using bcrypt
        const passwordMatches = await bcrypt.compare(
            password,
            user.passwordHash
        )

        if (!passwordMatches) {
            return res.status(401).json({
                error: "Invalid login credentials"
            });
        }

        return res.status(200).json({
            message: "Login successful",
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        })

    }catch(error){
        console.error("There was an error with attempted login", error)
        return res.status(500).json({
            error: "Error during login"
        })
        
    }
})

router.post("/register", async (req, res) => {
    try{
        const username = typeof req.body.username === "string"
            ? req.body.username.trim().toLowerCase()
            : req.body.username
        const password = req.body.password
        //Default role is user
        const role = 'user'

        //verify username and password are valid format
        const valid = verifyRegister(username, password)
        if(valid !== "valid"){
            return res.status(400).json(
                {error: valid}
            )
        }

        //check that user does not already exist
        const existingUser = users.find(
            user => user.username === username
        )

        if(existingUser){
            return res.status(409).json({
                error: "User already exists"
            })
        }

        //Hash password using bcrypt
        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(password, saltRounds)

        users.push({
            id: randomUUID(),
            username: username,
            passwordHash: hashedPassword,
            role: role
        })

        return res.status(201).json("User registered successfully")

    }catch(error){
        console.error("There was an error during the register process", error)
        res.status(500).json("There was a problem registering the user")
        return
    }
})

module.exports = router