import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import MaskEditor from './components/MaskEditor';
import TestRequest from './components/TestRequest';

function ErrorFallback({error}) {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
      <div className="p-6 max-w-sm">
        <h2 className="text-xl font-bold mb-4">Something went wrong:</h2>
        <pre className="text-red-400 text-sm overflow-auto">
          {error.message}
        </pre>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Router>
        <TestRequest />
        <Routes>
          <Route path="/" element={<Navigate to="/edit" replace />} />
          <Route path="/edit" element={<div>Please use an edit link from Discord</div>} />
          <Route path="/edit/:sessionId" element={<MaskEditor />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;