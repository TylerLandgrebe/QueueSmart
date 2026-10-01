import NavigationBar from "../../components/NavigationBar"
import "./UserPages.css"

function UserDashboard(){

    return(
        <>
            <NavigationBar userType={"user"}/>
            <main className="user-page">
                <div className="user-content">
                    <header className="user-topline">
                        <div>
                            <p className="user-brand">QueueSmart / User</p>
                            <h1>Welcome to QueueSmart</h1>
                            <p className="user-subtitle">Check your queue status and manage your appointments.</p>
                        </div>
                    </header>

                    <section className="current-queues" aria-label="User overview">
                        <p><strong>0</strong><span>appointments</span></p>
                        <p><strong>0</strong><span>queues joined</span></p>
                        <p><strong>0</strong><span>waiting time</span></p>
                    </section>

                    <section className="services-summary" aria-labelledby="service-overview-title">
                        <div className="user-section-heading">
                            <div>
                                <h2 id="service-overview-title">Available Services</h2>
                                <p>Join a queue for any of the following services.</p>
                            </div>
                        </div>
                    </section>

                    <section className="notifications-summary" aria-labelledby="notifications-title">
                        <div className="user-section-heading">
                            <div>
                                <h2 id="notifications-title">Notifications</h2>
                                <p>Stay updated on your queue status and appointments.</p>
                            </div>
                        </div>
                    </section>
                </div>
            </main>
        </>
    )
}

export default UserDashboard