import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import Parse from './parseConfig';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = Parse.User.current();
      if (!currentUser) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }
      setIsAuthenticated(true);
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const handleLogin = async () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    await Parse.User.logOut();
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <div className="text-2xl text-gray-700">Chargement...</div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-app bg-gray-100">
        {isAuthenticated && <Navbar isAuthenticated={isAuthenticated} onLogout={handleLogout} />}
        <div className="container mx-auto px-4 md:px-0">
          <main className="flex-1 container mx-auto pb-20">
            <Routes>
              <Route path="/login" element={
                !isAuthenticated ? (
                  <Auth onLogin={handleLogin} />
                ) : (
                  <Navigate to="/" replace />
                )
              } />
              <Route path="/" element={
                isAuthenticated ? (
                  <div className="text-center mt-8">
                    <h1 className="text-2xl font-bold text-gray-800">Bienvenue !</h1>
                    <p className="mt-4 text-gray-600">Vous êtes connecté.</p>
                  </div>
                ) : (
                  <Navigate to="/login" replace />
                )
              } />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;