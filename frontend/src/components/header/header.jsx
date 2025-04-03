import React from 'react';
import './header.css';

export default function Header({ onOpenModal }) {
  return (
    <header className="header">
      <a href="/" className="logo">
        <img src="/assets/logo.png" alt="logo" />
      </a>
      <p className="name">Convertools</p>
      <div className="profi">
        <button 
          className="profile" 
          onClick={() => onOpenModal('login')} // Добавлен обработчик клика
        >
          <img src="/assets/profile.png" alt="profile" />
        </button>
      </div>
    </header>
  );
}