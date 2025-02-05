import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MaskEditor from './components/MaskEditor';
import TestRequest from './components/TestRequest';

function App() {
  return (
    <Router>
      <TestRequest />
      <Routes>
        <Route path="/" element={<Navigate to="/edit" replace />} />
        <Route path="/edit" element={<div>Please use an edit link from Discord</div>} />
        <Route path="/edit/:sessionId" element={<MaskEditor />} />
      </Routes>
    </Router>
  );
}

export default App;