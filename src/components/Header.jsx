'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Exact 7 navigation items requested
  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Shillong Teer', href: '/shillong-teer-result/' },
    { label: 'Khanapara Teer', href: '/khanapara-teer-result/' },
    { label: 'Juwai Teer', href: '/juwai-teer-result/' },
    { label: 'Night Teer', href: '/shillong-night-teer/' },
    { label: 'Dream Numbers', href: '/teer-dream-numbers/' },
    { label: 'Previous Results', href: '/previous-results/' },
  ];

  // Robust URL-based active route matching
  const isRouteActive = (href) => {
    if (href === '/') {
      return pathname === '/';
    }
    const cleanPath = pathname.replace(/\/$/, '');
    const cleanHref = href.replace(/\/$/, '');
    return cleanPath === cleanHref;
  };

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="site-header">
      <div className="container header-container">
        {/* Brand Logo */}
        <Link href="/" className="header-logo" title="TeerResult2 Home">
          <span className="logo-text">TeerResult2</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="desktop-nav" aria-label="Main Navigation">
          <ul className="nav-btn-list">
            {navItems.map((item) => {
              const active = isRouteActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`nav-btn ${active ? 'active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Mobile Hamburger Button */}
        <button
          className="mobile-hamburger-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-drawer"
          aria-label="Toggle navigation menu"
        >
          <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
          <span className={`hamburger-bar ${mobileMenuOpen ? 'open' : ''}`}></span>
        </button>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation-drawer"
          className="mobile-nav-drawer"
          aria-label="Mobile Navigation"
        >
          <div className="container">
            <ul className="mobile-nav-list">
              {navItems.map((item) => {
                const active = isRouteActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`mobile-nav-btn ${active ? 'active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
      )}
    </header>
  );
}
