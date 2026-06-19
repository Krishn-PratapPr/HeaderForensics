import React, { useState } from 'react';
import { Network, Server, ArrowDown, ChevronDown, ChevronUp } from 'lucide-react';

export default function HopTimeline({ hops }) {
  const [expandedHops, setExpandedHops] = useState({});

  if (!hops || hops.length === 0) return null;

  const toggleExpand = (hopNum) => {
    setExpandedHops(prev => ({
      ...prev,
      [hopNum]: !prev[hopNum]
    }));
  };

  return (
    <div className="relative border-l-2 border-slate-200 ml-2 sm:ml-4 pl-4 sm:pl-6 space-y-6">
      {hops.map((hop, index) => {
        const isFirst = index === 0;
        const isLast = index === hops.length - 1;
        const hasPublic = hop.has_public_ip;
        const hopNum = hop.hop_number;
        const isExpanded = expandedHops[hopNum];
        const rawText = hop.raw_text;
        
        // Highlight states
        const borderClass = isFirst 
          ? 'border-l-4 border-l-orange-500 border-y-slate-200 border-r-slate-200' 
          : 'border-slate-200';
          
        const dotBgClass = isFirst
          ? 'bg-orange-500 ring-4 ring-orange-100'
          : !hasPublic
            ? 'bg-slate-300 ring-4 ring-slate-100'
            : 'bg-blue-600 ring-4 ring-blue-100';

        const cardBgClass = !hasPublic 
          ? 'bg-slate-50 border-slate-200 text-slate-500' 
          : 'bg-white border-slate-200';

        // Extract first 150 chars
        const textSnippet = rawText.length > 150 
          ? `${rawText.slice(0, 150)}...` 
          : rawText;

        return (
          <div key={hopNum} className="relative">
            {/* Timeline Dot */}
            <div className={`absolute -left-[35px] top-1.5 w-4.5 h-4.5 rounded-full flex items-center justify-center ${dotBgClass}`}>
              {isFirst ? (
                <Network className="w-2.5 h-2.5 text-white" />
              ) : (
                <Server className="w-2.5 h-2.5 text-white" />
              )}
            </div>

            {/* Timeline Connector Card */}
            <div className={`border rounded-lg p-3 sm:p-4 shadow-sm transition-all ${borderClass} ${cardBgClass}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    isFirst 
                      ? 'bg-orange-100 text-orange-800' 
                      : !hasPublic
                        ? 'bg-slate-150 text-slate-700'
                        : 'bg-blue-50 text-blue-800'
                  }`}>
                    Hop {hopNum} {isFirst && '(Origin)'}
                  </span>
                  
                  {!hasPublic && (
                    <span className="text-xs font-medium text-slate-400">
                      Internal relay — no public IP
                    </span>
                  )}
                </div>

                {hasPublic && (
                  <div className="flex flex-wrap gap-1 items-center">
                    <span className="text-xs font-semibold text-slate-600 mr-1">Public IPs:</span>
                    {hop.public_ips.map(ip => (
                      <span key={ip} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded border border-slate-200 font-mono">
                        {ip}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Raw Header Snippet with Toggle */}
              <div className="bg-slate-50 rounded border border-slate-200 p-2.5 font-mono text-[11px] leading-relaxed break-all whitespace-pre-wrap select-text">
                <span className="text-slate-700">
                  {isExpanded ? rawText : textSnippet}
                </span>
                {rawText.length > 150 && (
                  <button
                    type="button"
                    onClick={() => toggleExpand(hopNum)}
                    className="ml-2 inline-flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-semibold cursor-pointer"
                  >
                    {isExpanded ? (
                      <>Show less <ChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>Show full <ChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>
            </div>
            
            {/* Down Arrow for Hops Flow */}
            {!isLast && (
              <div className="absolute -left-[30px] bottom-[-24px] z-10 text-slate-400">
                <ArrowDown className="w-3 h-3" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
