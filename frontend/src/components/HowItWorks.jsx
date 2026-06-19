import React, { useState } from 'react';
import { 
  ChevronDown, ChevronUp, FileText, Cpu, Globe, ShieldCheck,
  ArrowRight, ExternalLink, Zap, Database, MapPin, Lock
} from 'lucide-react';

const PIPELINE_STEPS = [
  {
    num: '01',
    title: 'Parse Headers',
    desc: "Raw email headers or .eml files are parsed using Python's email.parser module. Key fields (From, To, SPF, DKIM, Received chains) are extracted and normalized.",
    icon: FileText,
    color: 'blue',
  },
  {
    num: '02',
    title: 'Reconstruct Hop Chain',
    desc: 'All Received: headers are reversed into chronological order. Public IPv4 addresses are extracted from each relay hop. The first public IP in the oldest hop becomes the originating IP.',
    icon: Cpu,
    color: 'indigo',
  },
  {
    num: '03',
    title: 'Geolocate Origin',
    desc: 'The originating IP is queried against two independent geolocation APIs in parallel. Results are cross-referenced — if both agree on city, a "Confirmed" badge is issued.',
    icon: Globe,
    color: 'emerald',
  },
  {
    num: '04',
    title: 'Score Authenticity',
    desc: 'SPF validation, DKIM presence, and domain alignment (From vs Return-Path) are each scored. A cumulative spoofing risk score (0–90) determines the verdict: Legitimate, Suspicious, or Likely Spoofed.',
    icon: ShieldCheck,
    color: 'amber',
  },
];

const API_CARDS = [
  {
    name: 'ipinfo.io',
    role: 'Primary Geolocation',
    desc: 'Returns city, region, country, ISP/org, coordinates, and timezone for any public IP. Used as the primary source for map rendering and geolocation tables.',
    endpoint: 'https://ipinfo.io/{ip}/json',
    icon: MapPin,
    color: 'blue',
    free: true,
  },
  {
    name: 'ip-api.com',
    role: 'Secondary Geolocation',
    desc: 'Independent secondary source queried in parallel. Provides the same geo fields via a different database. Used for cross-validation — if both sources agree, confidence is "Confirmed".',
    endpoint: 'http://ip-api.com/json/{ip}',
    icon: Globe,
    color: 'emerald',
    free: true,
  },
  {
    name: 'SQLite Registry',
    role: 'Local Flagged IP Database',
    desc: 'A local SQLite database stores analyst-flagged IPs with reference IDs, notes, and timestamps. On each analysis, the originating IP is checked against this registry for prior flags.',
    endpoint: 'Local — /instance/registry.db',
    icon: Database,
    color: 'slate',
    free: false,
  },
];

const colorMap = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    iconBg: 'bg-blue-100',    numText: 'text-blue-600',    dot: 'bg-blue-500' },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  iconBg: 'bg-indigo-100',  numText: 'text-indigo-600',  dot: 'bg-indigo-500' },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', iconBg: 'bg-emerald-100', numText: 'text-emerald-600', dot: 'bg-emerald-500' },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   iconBg: 'bg-amber-100',   numText: 'text-amber-600',   dot: 'bg-amber-500' },
  slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-700',   iconBg: 'bg-slate-100',   numText: 'text-slate-600',   dot: 'bg-slate-500' },
};

export default function HowItWorks() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto mb-6 sm:mb-8">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full group flex items-center justify-between gap-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-4 sm:px-5 py-3 sm:py-3.5 shadow-sm transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-50 border border-blue-200 p-1.5 rounded-md">
            <Zap className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-700">
            How does this work?
          </span>
          <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
            — Pipeline, APIs & Architecture
          </span>
        </div>
        <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expandable Content */}
      {isOpen && (
        <div className="mt-3 space-y-5 animate-slideDown">
          {/* SECTION 1: Analysis Pipeline */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-500" />
                Analysis Pipeline
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                Every header submission goes through a 4-step forensic pipeline.
              </p>
            </div>

            <div className="p-4 sm:p-6">
              {/* Pipeline steps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {PIPELINE_STEPS.map((step, idx) => {
                  const colors = colorMap[step.color];
                  const Icon = step.icon;
                  return (
                    <div
                      key={step.num}
                      className={`relative border ${colors.border} rounded-lg p-3.5 sm:p-4 ${colors.bg} transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`${colors.iconBg} p-2 rounded-lg shrink-0`}>
                          <Icon className={`w-4 h-4 ${colors.text}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold ${colors.numText} uppercase tracking-widest`}>
                              Step {step.num}
                            </span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800 mb-1">
                            {step.title}
                          </h4>
                          <p className="text-[11px] leading-relaxed text-slate-600">
                            {step.desc}
                          </p>
                        </div>
                      </div>

                      {/* Arrow connector between steps (only on sm+ grid) */}
                      {idx < PIPELINE_STEPS.length - 1 && idx % 2 === 0 && (
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 text-slate-300 hidden sm:block">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: APIs & Data Sources */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-slate-100">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-4 h-4 text-slate-500" />
                APIs & Data Sources
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1">
                Two external geolocation APIs are queried in parallel for cross-validated results.
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                {API_CARDS.map((api) => {
                  const colors = colorMap[api.color];
                  const Icon = api.icon;
                  return (
                    <div
                      key={api.name}
                      className="border border-slate-200 rounded-lg p-3.5 sm:p-4 bg-white hover:bg-slate-50 transition-all hover:shadow-md"
                    >
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className={`${colors.iconBg} p-1.5 rounded-md`}>
                          <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight">
                            {api.name}
                          </h4>
                          <span className={`text-[10px] font-semibold ${colors.numText} uppercase tracking-wide`}>
                            {api.role}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] leading-relaxed text-slate-600 mb-3">
                        {api.desc}
                      </p>

                      <div className="bg-slate-50 border border-slate-150 rounded p-2">
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">
                          Endpoint
                        </span>
                        <code className="text-[10px] sm:text-[11px] font-mono text-slate-700 break-all leading-relaxed">
                          {api.endpoint}
                        </code>
                      </div>

                      <div className="flex items-center gap-2 mt-2.5">
                        {api.free ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <Zap className="w-2.5 h-2.5" />
                            Free Tier
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">
                            <Lock className="w-2.5 h-2.5" />
                            Local Storage
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Architecture summary bar */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <div className="bg-blue-100 p-1.5 rounded-md">
                <Lock className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className="text-xs font-bold text-slate-700">Privacy Note</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All analysis runs on your local server. Email headers are never stored or transmitted to third parties — only the originating IP is sent to geolocation APIs for lookup. The flagged IP registry is stored locally in SQLite.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
