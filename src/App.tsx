import './App.css'
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import SyncPage from './SyncPage';

function App() {


  return (
    <Router>
      <Routes>
        <Route path="/" element={<SyncPage />} />
        {/* Add more routes here as your application grows */}
      </Routes>
    </Router>
  )
}

export default App
