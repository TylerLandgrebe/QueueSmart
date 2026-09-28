import { BrowserRouter as Router, Route, Routes} from "react-router-dom"
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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/join-queue" element={<JoinQueue />} />
        <Route path="/queue-status" element={<QueueStatus />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/history" element={<History />} />

        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/service-management" element={<ServiceManagement />} />
        <Route path="/queue-management" element={<QueueManagement />} />
      </Routes>
    </Router>
  )
}

export default App
