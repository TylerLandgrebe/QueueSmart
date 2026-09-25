import './Login.css'

function Login(){
    //Temp login info for testing purposes
    const userLogin = {
        username: "user",
        password: "password"
    } 

    const adminLogin = {
        username: "admin",
        password: "adminpass"
    }

    return(
        <div className = 'login-layout'>
            <h1>QueueSmart</h1>
            <h2>Sign in to your account</h2>

            <form>
                <div className='login-container'>

                    <label htmlFor="uname"><b>Username</b></label>
                    <input id="uname" type="text" placeholder="Enter Username" name="uname" required />

                    <label htmlFor='password'><b>Password</b></label>
                    <input id="password" type="password" placeholder="Enter Password" name="password" required />

                    <button type="submit">Login</button>
                </div>
            </form>
        </div>
)}

export default Login