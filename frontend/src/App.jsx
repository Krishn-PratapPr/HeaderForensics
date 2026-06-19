import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Registry from './pages/Registry';
import { Shield, FileSearch, Database, Menu, X } from 'lucide-react';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinkClasses = ({ isActive }) =>
    `flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-semibold transition-colors ${
      isActive
        ? 'bg-blue-50 text-blue-700'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
    }`;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14 sm:h-16">
          {/* Logo brand */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="bg-blue-600 text-white p-1.5 sm:p-2 rounded-lg shadow-sm shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-slate-800 block leading-tight truncate">EHA Forensic Suite</span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium tracking-wide uppercase hidden xs:block">Email Header Analyzer</span>
            </div>
          </div>

          {/* Desktop Navigation tabs */}
          <nav className="hidden md:flex gap-1">
            <NavLink to="/" end className={navLinkClasses}>
              <FileSearch className="w-3.5 h-3.5" />
              Forensic Dashboard
            </NavLink>
            <NavLink to="/registry" className={navLinkClasses}>
              <Database className="w-3.5 h-3.5" />
              Flagged Registry
            </NavLink>
          </nav>

          {/* Mobile hamburger button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1 shadow-lg animate-slideDown">
            <NavLink
              to="/"
              end
              className={navLinkClasses}
              onClick={() => setMobileMenuOpen(false)}
            >
              <FileSearch className="w-4 h-4" />
              Forensic Dashboard
            </NavLink>
            <NavLink
              to="/registry"
              className={navLinkClasses}
              onClick={() => setMobileMenuOpen(false)}
            >
              <Database className="w-4 h-4" />
              Flagged Registry
            </NavLink>
          </div>
        )}
      </header>

      {/* Main View Container */}
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/registry" element={<Registry />} />
        </Routes>
      </main>

      {/* Footer block */}
      <footer className="bg-white border-t border-slate-200 py-4 sm:py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5 sm:space-y-2 select-text">
          <p className="font-medium text-[11px] sm:text-xs leading-relaxed">🛡️ Email Header Analyzer Forensic Suite — B&W Printer Laser Friendly Reports Enabled</p>
          <p className="text-[9px] sm:text-[10px] leading-relaxed">
            Statutory Forensic Policy: This tool is intended for information security investigation and evidence cataloging.
          </p>
        </div>
      </footer>
    </div>
  );
}
