import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on app load
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    console.log('AuthContext - Login called with:', { userData, token: token ? 'Token exists' : 'No token' });
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    console.log('AuthContext - Token stored in localStorage:', localStorage.getItem('token') ? 'Success' : 'Failed');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const isAuthenticated = () => {
    return !!user && !!localStorage.getItem('token');
  };

  const getDashboardPath = () => {
    if (!user) return '/login';
    
    switch (user.userType) {
      case 'super_admin':
        return '/admin/dashboard';
      case 'company_admin':
        return '/company/dashboard';
      default:
        return '/dashboard';
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    getDashboardPath
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
