import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MaskEditor from './components/MaskEditor';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/edit" replace />} />
        <Route path="/edit" element={<div>Please use an edit link from Discord</div>} />
        <Route path="/edit/:sessionId" element={<MaskEditor />} />
      </Routes>
    </Router>
  );
}

export default App;