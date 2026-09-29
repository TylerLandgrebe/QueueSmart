import { BrowserRouter as Router, Navigate, Route, Routes} from "react-router-dom"
import Login from './pages/Login.jsx'
// user pages
import UserDashboard from "./pages/user/UserDashboard.jsx"
import JoinQueue from "./pages/user/JoinQueue.jsx"
import QueueStatus from "./pages/user/QueueStatus.jsx"
import Notifications from "./pages/user/Notifications.jsx"
import History from "./pages/user/History.jsx"
// admin pages
import AdminDashboard from "./pages/admin/AdminDashboard.jsx"
import ServiceManagement from "./pages/admin/ServiceManagement.jsx"
import QueueManagement from "./pages/admin/QueueManagement.jsx"

function RequireRole({ role, children }) {
  let session = null
  try {
    session = JSON.parse(sessionStorage.getItem("queuesmart-session"))
  } catch {
    session = null
  }

  if (!session) return <Navigate to="/" replace />
  if (session.role !== role) {
    return <Navigate to={session.role === "admin" ? "/admin-dashboard" : "/user-dashboard"} replace />
  }
  return children
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/user-dashboard" element={<RequireRole role="user"><UserDashboard /></RequireRole>} />
        <Route path="/join-queue" element={<RequireRole role="user"><JoinQueue /></RequireRole>} />
        <Route path="/queue-status" element={<RequireRole role="user"><QueueStatus /></RequireRole>} />
        <Route path="/notifications" element={<RequireRole role="user"><Notifications /></RequireRole>} />
        <Route path="/history" element={<RequireRole role="user"><History /></RequireRole>} />

        <Route path="/admin-dashboard" element={<RequireRole role="admin"><AdminDashboard /></RequireRole>} />
        <Route path="/service-management" element={<RequireRole role="admin"><ServiceManagement /></RequireRole>} />
        <Route path="/queue-management" element={<RequireRole role="admin"><QueueManagement /></RequireRole>} />
      </Routes>
    </Router>
  )
}

export default App
