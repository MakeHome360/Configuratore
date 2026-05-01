import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, ArrowRight, Phone } from 'lucide-react';

const NAV = [
  { name: 'Ristrutturazioni', href: '#servizi' },
  { name: 'Arredamento', href: '#servizi' },
  { name: 'Pacchetti', href: '#pacchetti' },
  { name: 'Progetti', href: '#progetti' },
  { name: 'Come funziona', href: '#processo' },
  { name: 'Contatti', href: '#contatti' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      {/* Top utility bar */}
      <div className="hidden lg:block bg-[#0A0A0A] text-white/80 text-[12px] font-medium tracking-wide">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-9">
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#1FAE52] animate-pulse" />
            <span>Preventivo bloccato · Nessun costo nascosto · Garanzia 5 anni</span>
          </div>
          <a href="tel:+390000000000" className="flex items-center gap-2 hover:text-[#1FAE52] transition-colors" data-testid="nav-phone">
            <Phone size={12} /> 800 123 456
          </a>
        </div>
      </div>

      <header
        className={`sticky top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-white/95 backdrop-blur-xl border-b border-zinc-200 shadow-sm py-3'
            : 'bg-white py-4'
        }`}
        data-testid="site-navbar"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3" data-testid="nav-logo">
              <img
                src="/brand/sadicasa-light.png"
                alt="Sa di Casa"
                className="h-32 sm:h-40 lg:h-48 w-auto"
              />
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-7">
              {NAV.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-[14px] font-medium text-zinc-700 hover:text-[#1FAE52] transition-colors"
                  data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {item.name}
                </a>
              ))}
            </nav>

            {/* Actions */}
            <div className="hidden lg:flex items-center gap-2">
              <Link
                to="/login"
                className="px-4 py-2.5 text-[14px] font-semibold text-[#0A0A0A] hover:text-[#1FAE52] transition-colors"
                data-testid="nav-login-btn"
              >
                Accedi
              </Link>
              <a
                href="#contatti"
                className="group flex items-center gap-2 bg-[#1FAE52] hover:bg-[#168540] text-white px-5 py-2.5 rounded-full text-[14px] font-semibold transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                data-testid="nav-cta-btn"
              >
                Richiedi preventivo
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </div>

            {/* Mobile toggle */}
            <button
              className="lg:hidden p-2 text-[#0A0A0A]"
              onClick={() => setOpen(!open)}
              aria-label="Apri menu"
              data-testid="mobile-menu-toggle"
            >
              {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="lg:hidden absolute top-full left-0 w-full bg-white border-b border-zinc-200 shadow-lg">
            <div className="flex flex-col p-4 space-y-1">
              {NAV.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="text-[15px] font-medium text-zinc-800 py-3 border-b border-zinc-100"
                  onClick={() => setOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4">
                <Link
                  to="/login"
                  className="text-center font-semibold text-[#0A0A0A] border border-zinc-300 py-3 rounded-full"
                  onClick={() => setOpen(false)}
                >
                  Accedi
                </Link>
                <a
                  href="#contatti"
                  className="text-center bg-[#1FAE52] text-white py-3 rounded-full font-semibold"
                  onClick={() => setOpen(false)}
                >
                  Richiedi preventivo
                </a>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
