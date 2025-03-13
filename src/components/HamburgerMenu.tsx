import React from 'react';

interface HamburgerMenuProps {
  onToggle: (e: React.MouseEvent) => void; // Consistent type with component
  isOpen: boolean;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ onToggle, isOpen }) => {
  return (
    <div className="flex flex-col items-center cursor-pointer" onClick={onToggle}>
      <div className={`w-8 h-1 bg-white transition-transform duration-300 ${isOpen ? 'transform rotate-45 translate-y-1.5' : ''} mb-1`} />
      <div className={`w-8 h-1 bg-white transition-opacity duration-300 ${isOpen ? 'opacity-0' : 'opacity-100'} mb-1`} />
      <div className={`w-8 h-1 bg-white transition-transform duration-300 ${isOpen ? 'transform -rotate-45 -translate-y-1.5' : ''}`} />
    </div>
  );
};

export default HamburgerMenu;