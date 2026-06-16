import React from 'react';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react';

export default function ConfidenceBadge({ confidence }) {
  if (!confidence) return null;
  
  const { color, label, status } = confidence;
  
  let bgClass = 'bg-slate-100 text-slate-800 border-slate-200';
  let Icon = Shield;
  
  if (color === 'green' || status === 'confirmed') {
    bgClass = 'bg-green-50 text-green-700 border-green-200';
    Icon = ShieldCheck;
  } else if (color === 'amber' || status === 'disagreed') {
    bgClass = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = ShieldAlert;
  } else if (color === 'red' || status === 'failed') {
    bgClass = 'bg-red-50 text-red-700 border-red-200';
    Icon = ShieldAlert;
  } else {
    // grey / single
    bgClass = 'bg-gray-100 text-gray-700 border-gray-200';
    Icon = Shield;
  }

  
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${bgClass}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}
