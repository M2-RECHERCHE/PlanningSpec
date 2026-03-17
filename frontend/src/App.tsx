import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './views/Home';
import Planification from './views/pages/Planification';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path='planification' element={<Planification />} />
      </Routes>
    </Router>
  );
}

export default App;

