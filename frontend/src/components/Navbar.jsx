import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Ristrutturazioni', path: '#servizi' },
    { name: 'Pacchetti', path: '#pacchetti' },
    { name: 'Progetti', path: '#progetti' },
    { name: 'Tecnologia', path: '#tecnologia' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-white/80 backdrop-blur-xl border-b border-[#E0DFD8] py-3 shadow-sm'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2" data-testid="nav-logo">
            <span className="font-serif text-2xl font-bold tracking-tight text-[#1C1C1A]">
              Ristruttura<span className="text-[#B34A31]">.CAD</span>
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.path}
                className="font-sans text-[15px] font-medium text-[#5C5C59] hover:text-[#1C1C1A] transition-colors"
                data-testid={`nav-link-${link.name.toLowerCase()}`}
              >
                {link.name}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              to="/login"
              className="font-sans text-[15px] font-medium text-[#1C1C1A] hover:text-[#B34A31] transition-colors"
              data-testid="nav-login-btn"
            >
              Accedi
            </Link>
            <Link
              to="/configuratoreesigenze"
              className="group flex items-center gap-2 bg-[#1C1C1A] text-white px-5 py-2.5 rounded hover:bg-[#B34A31] transition-colors font-sans text-[15px] font-medium"
              data-testid="nav-cta-btn"
            >
              Preventivo gratuito
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden text-[#1C1C1A] p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-[#E0DFD8] shadow-lg">
          <div className="flex flex-col p-4 space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.path}
                className="font-sans text-lg font-medium text-[#1C1C1A] py-2 border-b border-gray-100"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.name}
              </a>
            ))}
            <div className="flex flex-col gap-3 pt-4">
              <Link
                to="/login"
                className="text-center font-sans font-medium text-[#1C1C1A] border border-[#E0DFD8] py-3 rounded"
                onClick={() => setMobileMenuOpen(false)}
              >
                Accedi
              </Link>
              <Link
                to="/configuratoreesigenze"
                className="text-center bg-[#B34A31] text-white py-3 rounded font-sans font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                Configura Preventivo
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;