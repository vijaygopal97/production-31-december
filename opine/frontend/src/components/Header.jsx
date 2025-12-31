import React, { useState } from 'react';
import { Menu, X, BarChart3, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, isAuthenticated, getDashboardPath } = useAuth();

  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <img 
                src="/logo.png" 
                alt="Convergent Logo" 
                className="h-12 w-auto"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-[#001D48] font-medium transition-colors duration-200">
              Home
            </Link>
            <Link to="/about" className="text-gray-700 hover:text-[#001D48] font-medium transition-colors duration-200">
              About
            </Link>
                  <Link to="/contact" className="text-gray-700 hover:text-[#001D48] font-medium transition-colors duration-200">
                    Contact
                  </Link>
          </nav>

                {/* Desktop Auth Buttons */}
                <div className="hidden md:flex items-center space-x-4">
                  {isAuthenticated() ? (
                    <Link to={getDashboardPath()} className="px-6 py-2 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white hover:text-white font-medium rounded-lg hover:from-[#002855] hover:via-[#3d3a8a] hover:to-[#4bb8d9] transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link to="/login" className="px-4 py-2 text-[#001D48] font-medium hover:text-[#373177] transition-colors duration-200">
                        Login
                      </Link>
                      <Link to="/register" className="px-6 py-2 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-medium rounded-lg hover:from-[#002855] hover:via-[#3d3a8a] hover:to-[#4bb8d9] transform hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-xl">
                        Register
                      </Link>
                    </>
                  )}
                </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-[#001D48] transition-colors duration-200"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              <Link to="/" className="text-gray-700 hover:text-[#001D48] font-medium transition-colors duration-200">
                Home
              </Link>
              <Link to="/about" className="text-gray-700 hover:text-[#001D48] font-medium transition-colors duration-200">
                About
              </Link>
                  <Link to="/contact" className="text-gray-700 hover:text-[#001D48] font-medium transition-colors duration-200">
                    Contact
                  </Link>
                    <div className="flex flex-col space-y-2 pt-4">
                      {isAuthenticated() ? (
                        <Link to={getDashboardPath()} className="px-6 py-2 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white hover:text-white font-medium rounded-lg hover:from-[#002855] hover:via-[#3d3a8a] hover:to-[#4bb8d9] transition-all duration-200 shadow-lg text-center flex items-center justify-center">
                          <User className="w-4 h-4 mr-2" />
                          Dashboard
                        </Link>
                      ) : (
                        <>
                          <Link to="/login" className="px-4 py-2 text-[#001D48] font-medium hover:text-[#373177] transition-colors duration-200 text-left">
                            Login
                          </Link>
                          <Link to="/register" className="px-6 py-2 bg-gradient-to-r from-[#001D48] via-[#373177] to-[#3FADCC] text-white font-medium rounded-lg hover:from-[#002855] hover:via-[#3d3a8a] hover:to-[#4bb8d9] transition-all duration-200 shadow-lg text-center">
                            Register
                          </Link>
                        </>
                      )}
                    </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
