import {NavLink} from 'react-router-dom'
import {useState} from 'react'
import { useNavigate } from 'react-router-dom'
import './NavigationBar.css'


function NavigationBar( {userType} ){

    const navClass = ({ isActive }) => {
        return isActive ? "active" : "";
    }

    const [showProfile, setShowProfile] = useState(false);
    const navigate = useNavigate();

    function handleLogout(){
        navigate("/");
    }

    return(
        <div className="icon-bar">
            {/*Navigation bar for user */}
            {userType === "user" && ( 
            <>
                <NavLink className={navClass} to="/user-dashboard">
                    <i className="fa fa-home" />
                    <span className="tooltip" >Dashboard</span>
                </NavLink>
                <NavLink className={navClass} to="/join-queue">
                    <i className="fa-solid fa-screwdriver-wrench" />
                    <span className="tooltip">Services</span>
                </NavLink>
                <NavLink className={navClass} to="/queue-status">
                    <i className="fa-solid fa-calendar" />
                    <span className="tooltip">Appointments</span>
                </NavLink>
                <NavLink className={navClass} to="/notifications">
                    <i className="fa-solid fa-bell" />
                    <span className="tooltip">Notifications</span>
                </NavLink>
                <NavLink className={navClass} to="/history">
                    <i className="fa-solid fa-timeline" />
                    <span className="tooltip">History</span>
                </NavLink>

                {/*Allow user to logout */}
                <div 
                    className="profile-container" 
                    onMouseOver={() => setShowProfile(true)}
                    onMouseOut={() => setShowProfile(false)}
                >
                    <button 
                        type="button"
                        className='profile-button' 
                    >
                        <i className="fa-solid fa-circle-user"></i>
                    </button>

                    {showProfile && (
                        <div className="profile-menu">
                            <button onClick={handleLogout}>
                                Logout
                            </button>
                        </div>
                    )}
                </div>
                
            </>
            )}

            {/*Navigation bar for admin */}
            {userType === "admin" && ( 
            <>
                <NavLink className={navClass} to="/admind-dashboard">
                    <i className="fa fa-home" />
                    <span className="tooltip" >Dashboard</span>
                </NavLink>
                <NavLink className={navClass} to="/service-management">
                    <i className="fa-solid fa-screwdriver-wrench" />
                    <span className="tooltip">Services</span>
                </NavLink>
                <NavLink className={navClass} to="/queue-management">
                    <i className="fa-solid fa-calendar" />
                    <span className="tooltip">Appointments</span>
                </NavLink>
                
                {/*Allow user to logout */}
                <div 
                    className="profile-container" 
                    onMouseOver={() => setShowProfile(true)}
                    onMouseOut={() => setShowProfile(false)}
                >
                    <button 
                        type="button"
                        className='profile-button' 
                    >
                        <i className="fa-solid fa-circle-user"></i>
                    </button>

                    {showProfile && (
                        <div className="profile-menu">
                            <button onClick={handleLogout}>
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </>
            )}
        </div>
    )
}

export default NavigationBar