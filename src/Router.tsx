import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { InputScreen } from './App';
import { DisplayScreen } from './DisplayScreen';

export const AppRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/number-input" element={<InputScreen />} />
        <Route path="/display" element={<DisplayScreen />} />
        <Route path="/" element={<Navigate to="/display" replace />} />
      </Routes>
    </Router>
  );
};
