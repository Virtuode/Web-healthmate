import React from 'react';

const HamburgerMenu: React.FC<{ onToggle: () => void; isOpen: boolean }> = ({ onToggle, isOpen }) => {
  return (
    <div className="flex flex-col items-center cursor-pointer" onClick={onToggle}>
      <div className={`w-8 h-1 bg-white transition-transform duration-300 ${isOpen ? 'transform rotate-45 translate-y-1.5' : ''} mb-1`} />
      <div className={`w-8 h-1 bg-white transition-opacity duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'} mb-1`} />
      <div className={`w-8 h-1 bg-white transition-transform duration-300 ${isOpen ? 'transform -rotate-45 -translate-y-1.5' : ''}`} />
    </div>
  );
};

export default HamburgerMenu; 