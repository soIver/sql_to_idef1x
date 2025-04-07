import React, { useContext } from 'react';
import './header.css';
import { AuthContext } from '../auth/AuthProvider';

export default function Header({ onOpenModal }) {
  const { isAuthenticated, logout } = useContext(AuthContext);

  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
    } else {
      onOpenModal('login');
    }
  };

  return (
    <header className="header">
      <a href="/" className="logo">
        <img src="/assets/logo.png" alt="logo" />
      </a>
      <p className="name">Convertools</p>
      <div className="profi">
        <button 
          className={`profile ${isAuthenticated ? 'logged-in' : ''}`} 
          onClick={handleAuthAction}
        >
          {isAuthenticated ? (
            <span>Выйти</span>
          ) : (
            <img src="/assets/profile.png" alt="profile" />
          )}
        </button>
      </div>
    </header>
  );
}