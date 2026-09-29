import {NavLink} from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import './NavigationBar.css'


function NavigationBar( {userType} ){

    const navClass = ({ isActive }) => {
        return isActive ? "active" : "";
    }

    const navigate = useNavigate();

    function handleLogout(){
        sessionStorage.removeItem("queuesmart-session");
        navigate("/", { replace: true });
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

                <button className="rail-logout" type="button" onClick={handleLogout}>
                    <i className="fa-solid fa-circle-user" aria-hidden="true" />
                </button>
                
            </>
            )}

            {/*Navigation bar for admin */}
            {userType === "admin" && ( 
            <>
                <NavLink className={navClass} to="/admin-dashboard">
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
                
                <button className="rail-logout" type="button" onClick={handleLogout}>
                    <i className="fa-solid fa-circle-user" aria-hidden="true" />
                </button>
            </>
            )}
        </div>
    )
}

export default NavigationBar
