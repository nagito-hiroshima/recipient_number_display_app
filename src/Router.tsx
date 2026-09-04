import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { InputScreen } from './App';
import { DisplayScreen } from './DisplayScreen';
import { PublicDisplayScreen } from './PublicDisplayScreen';

export const AppRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DisplayScreen />} />
        <Route path="/display" element={<PublicDisplayScreen />} />
        <Route path="/number-input" element={<InputScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};
