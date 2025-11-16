import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Processing from './pages/Processing';
import Reports from './pages/Reports';
import SavedResults from './pages/SavedResults';
import StatusManagement from './pages/StatusManagement';
import SettingsPage from './pages/SettingsPage';
import ConnectionTest from './pages/ConnectionTest';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/processing" element={<Processing />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/:runId" element={<Reports />} />
            <Route path="/saved-results" element={<SavedResults />} />
            <Route path="/status-management" element={<StatusManagement />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/connection-test" element={<ConnectionTest />} />
          </Routes>
        </div>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </Router>
  );
}

export default App;
