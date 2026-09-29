import {useEffect, useRef, useState} from "react";
import {useNavigate} from "react-router-dom"
import './Login.css'


function Login(){
    const navigate = useNavigate()

    // Keep track of username/password info
    const [username, setUsername] = useState("")
    const [password, setPassword] = useState("")

    const [register, setRegister] = useState(false)
    const [message, setMessage] = useState(null)
    const usernameInput = useRef(null)

    useEffect(() => {
        usernameInput.current?.focus()
    }, [register])

    //Temp login info for testing purposes
    const [userLogin, setUserLogin] = useState([{
        username: "user",
        password: "password"
    }]) 

    const [adminLogin, setAdminLogin] = useState ([{
        username: "admin",
        password: "adminpass"
    }])

    function handleLogin(e){
        e.preventDefault();

        if (
            userLogin.some((login) => (
                username == login.username && 
                password == login.password
            ))
        ) {
            sessionStorage.setItem("queuesmart-session", JSON.stringify({ username, role: "user" }))
            navigate('/user-dashboard')
        }
        else if (
            adminLogin.some((login) => (
                username === login.username &&
                password === login.password
            ))
        ) {
            sessionStorage.setItem("queuesmart-session", JSON.stringify({ username, role: "admin" }))
            navigate('/admin-dashboard')
        }
        else {
            setMessage({ type: "error", text: "Invalid username or password. Please try again." })
            setPassword("")
            usernameInput.current?.focus()
        }
    }

    //No constraints on login credentials
    //Login credentials are not saved long term
    function handleRegister(e) { 
        e.preventDefault();

        let newLogin = {username: username, password: password};
        setUserLogin(userLogin => [...userLogin, newLogin]);
        setUsername("")
        setPassword("")
        setRegister(false)
        setMessage({ type: "success", text: "Your account has been created. Sign in to continue." })
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
