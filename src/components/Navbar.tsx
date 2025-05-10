import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Parse from '../parseConfig';

interface NavbarProps {
  isAuthenticated: boolean;
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, onLogout }) => {
  const location = useLocation();
  const [user, setUser] = useState<Parse.User | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    const currentUser = Parse.User.current();
    if (currentUser) {
      setUser(currentUser);
    }
  }, [isAuthenticated]);

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  return (
    <div className="container mx-auto flex items-center justify-between px-4 py-4 md:px-0">
      <div className="flex items-center space-x-6">
        <nav className="hidden md:flex space-x-4">
          <Link 
            to="/" 
            className={`px-2 lg:px-4 py-2 rounded-full shadow-lg transition duration-300 ${
              isActive('/') 
                ? 'bg-gray-900 text-gray-100' 
                : 'bg-white text-gray-800 hover:bg-gray-900 hover:text-gray-100'
            }`}
          >
            <span className="text-xl">🏠</span>
            <span className="hidden xl:inline ml-2">Accueil</span>
          </Link>
        </nav>
      </div>
      
      <div className="flex items-center space-x-4">
        {isAuthenticated && user ? (
          <div className="relative">
            <button
              onClick={toggleUserMenu}
              className="flex items-center space-x-2 cursor-pointer bg-white text-gray-800 px-4 py-2 rounded-full shadow-lg hover:bg-gray-900 hover:text-gray-100 transition duration-300"
            >
              <span className="text-xl">👤</span>
              <span className="hidden md:inline">{user.get('username') || user.get('email')}</span>
              <span className="text-sm">▼</span>
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-gray-200">
                  <p className="text-sm font-semibold text-gray-800">{user.get('username') || user.get('email')}</p>
                  <p className="text-xs text-gray-500">{user.get('email')}</p>
                </div>
                <div className="px-4 py-2">
                  <p className="text-xs text-gray-500">
                    Membre depuis: {new Date(user.get('createdAt')).toLocaleDateString()}
                  </p>
                </div>
                <div className="border-t border-gray-200 mt-2">
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition duration-200"
                  >
                    <span className="text-xl mr-2">🚪</span>Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link
            to="/login"
            className="cursor-pointer bg-white text-gray-800 px-4 py-2 rounded-full shadow-lg hover:bg-gray-900 hover:text-gray-100 transition duration-300"
          >
            <span className="text-xl mr-2">🔑</span>Connexion
          </Link>
        )}
      </div>
    </div>
  );
};

export default Navbar;