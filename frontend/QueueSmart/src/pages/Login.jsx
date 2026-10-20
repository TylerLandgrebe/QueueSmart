import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom"
import { useAuth } from "../auth/AuthContext.jsx"
import './Login.css'

const API = "http://localhost:3000/"

function Login(){
    const navigate = useNavigate()
    const {setUser} = useAuth()

    // Keep track of username/password info
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    const [register, setRegister] = useState(false)
    const [message, setMessage] = useState(null)
    const usernameInput = useRef(null)

    useEffect(() => {
        usernameInput.current?.focus()
    }, [register])

    async function handleLogin(e) {
        e.preventDefault()

        try {
            const response = await fetch(`${API}api/auth/login`, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: 'include',
                body: JSON.stringify({
                    username: username,
                    password: password
                })
            })

            const data = await response.json()

            if (!response.ok) {
                setMessage({
                    type: "error",
                    text: data.error || "Login failed"
                })
                setPassword("")
                usernameInput.current?.focus()
                return
            }

            // Login successful
            setMessage({
                type: "success",
                text: "Login successful"
            })

            setPassword("")
            setUser(data.user)

            // Navigate to the appropriate dashboard
            if (data.user.role === "admin") {
                navigate("/admin-dashboard")
            } else {
                navigate("/user-dashboard")
            }

        } catch (error) {
            console.error("Login request failed:", error)

            setMessage({
                type: "error",
                text: "Unable to connect to the server"
            })
        }
    }

    
    async function handleRegister(e) { 
        e.preventDefault();

        try { 
            let newLogin = {username: username, password: password}

            const response = await fetch(`${API}api/auth/register`, { 
                method: 'POST',
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(newLogin)
            })

            const data = await response.json()

            if(!response.ok){
                setMessage({
                    type: 'error',
                    text: data.error || "Registration Failed"
                })
                setPassword("")
                usernameInput.current?.focus()
                return
            }

            //Registration successful
            setUsername("")
            setPassword("")
            setRegister(false)
            setMessage({
                type: 'success',
                text: 'Your account has been created. Sign in to continue'
            })

        }catch(error){
            console.error("Registration was unsuccessful", error)

            setMessage({
                type: 'error',
                text: "Unhandled error", error
            })
        }

        
    }

    // Change between login and register page
    function changeForm(){
        setUsername("")
        setPassword("")
        setMessage(null)
        setRegister(!register)
    }

    return(
        <div className = 'login-layout'>
            <h1>QueueSmart</h1>

            {/*Login Form*/}
            {!register && 
            <form onSubmit = {handleLogin}>
                <h2>Sign in to your account</h2>
                <div className='login-container'>
                    {message && <p className={`login-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}

                    <label htmlFor="uname"><b>Username</b></label>
                    <input 
                        id="uname" 
                        ref={usernameInput}
                        type="text" 
                        placeholder="Enter Username" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required 
                    />

                    <label htmlFor='password'><b>Password</b></label>
                    <input 
                        id="password" 
                        type="password" 
                        placeholder="Enter Password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required 
                    />

                    <button className="login-btn" type="submit">Login</button>
                </div>
                <p>Don't have an account? <a onClick={(() => changeForm())}>register</a></p>
            </form>
            }

            {/*REGISTER FORM
            More fields can be added when connected to database*/}
            {register && 
            <form onSubmit = {handleRegister}>
                <h2>Register your account</h2>
                <div className='login-container'>
                    {message && <p className={`login-message ${message.type}`} role={message.type === "error" ? "alert" : "status"}>{message.text}</p>}

                    <label htmlFor="uname"><b>Username</b></label>
                    <input 
                        id="uname" 
                        ref={usernameInput}
                        type="text" 
                        placeholder="Enter Username" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required 
                    />

                    <label htmlFor='password'><b>Password</b></label>
                    <input 
                        id="password" 
                        type="password" 
                        placeholder="Enter Password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required 
                    />

                    <button className="register-btn" type="submit">Register</button>
                </div>
                <p>Already have an account? <a onClick={(() => changeForm())}>login</a></p>
            </form>}


        </div>
)}

export default Login
