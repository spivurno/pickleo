import React, { useState, useEffect } from 'react';
import HomePage from './pages/HomePage.jsx';
import SessionPage from './pages/SessionPage.jsx';

function getSessionIdFromPath() {
  const match = window.location.pathname.match(/^\/([a-f0-9]{8})$/);
  return match ? match[1] : null;
}

export default function App() {
  const [sessionId, setSessionId] = useState(getSessionIdFromPath);

  useEffect(() => {
    const onPop = () => setSessionId(getSessionIdFromPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function navigate(path) {
    history.pushState(null, '', path);
    setSessionId(getSessionIdFromPath());
  }

  if (sessionId) {
    return <SessionPage sessionId={sessionId} navigate={navigate} />;
  }
  return <HomePage navigate={navigate} />;
}
