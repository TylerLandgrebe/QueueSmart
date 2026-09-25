import { BrowserRouter as Router, Route, Routes} from "react-router-dom"
import Login from './pages/Login.jsx'
import UserDashboard from "./pages/UserDashboard.jsx"
import AdminDashboard from "./pages/AdminDashboard.jsx"

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  )
}

export default App
