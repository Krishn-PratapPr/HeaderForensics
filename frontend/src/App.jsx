import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Registry from './pages/Registry';
import { Shield, FileSearch, Database } from 'lucide-react';

export default function App() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800">
      {/* Navigation Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Logo brand */}
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 text-white p-2 rounded-lg shadow-sm">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-800 block leading-tight">EHA Forensic Suite</span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Email Header Analyzer</span>
            </div>
          </div>

          {/* Navigation tabs */}
          <nav className="flex gap-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <FileSearch className="w-3.5 h-3.5" />
              Forensic Dashboard
            </NavLink>
            <NavLink
              to="/registry"
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Database className="w-3.5 h-3.5" />
              Flagged Registry
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Main View Container */}
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/registry" element={<Registry />} />
        </Routes>
      </main>

      {/* Footer block */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-2 select-text">
          <p className="font-medium">🛡️ Email Header Analyzer Forensic Suite — B&W Printer Laser Friendly Reports Enabled</p>
          <p className="text-[10px]">
            Statutory Forensic Policy: This tool is intended for information security investigation and evidence cataloging.
          </p>
        </div>
      </footer>
    </div>
  );
}
