import React, { createContext, useContext, useState, useCallback } from 'react';
import ToastContainer from '../components/common/ToastContainer';

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random();
    const newToast = {
      id,
      type: 'success',
      duration: 5000,
      ...toast,
    };
    
    setToasts(prev => [...prev, newToast]);
    
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((title, message, duration = 5000) => {
    return addToast({ type: 'success', title, message, duration });
  }, [addToast]);

  const showError = useCallback((title, message, duration = 7000) => {
    return addToast({ type: 'error', title, message, duration });
  }, [addToast]);

  const showWarning = useCallback((title, message, duration = 6000) => {
    return addToast({ type: 'warning', title, message, duration });
  }, [addToast]);

  const showInfo = useCallback((title, message, duration = 5000) => {
    return addToast({ type: 'info', title, message, duration });
  }, [addToast]);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const value = {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAll,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};


















