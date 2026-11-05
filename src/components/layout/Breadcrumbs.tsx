import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { navigationItems } from './navigationItems';

export const Breadcrumbs: React.FC = () => {
  const location = useLocation();
  const currentNav = navigationItems.find((item) => item.path === location.pathname);

  return (
    <nav className="flex items-center gap-2 text-xs font-mono text-gogreen-text-secondary select-none">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-gogreen-primary transition-colors"
      >
        <Home className="w-3.5 h-3.5" />
        <span>GoGreen</span>
      </Link>
      {currentNav && currentNav.path !== '/' && (
        <>
          <ChevronRight className="w-3 h-3 text-gogreen-border" />
          <span className="text-gogreen-text-primary font-medium">{currentNav.label}</span>
        </>
      )}
    </nav>
  );
};
