import React, { useState } from 'react';
import axiosInstance from '../api/axiosConfig';
import HeaderInput from '../components/HeaderInput';
import HopTimeline from '../components/HopTimeline';
import MapWidget from '../components/MapWidget';
import ConfidenceBadge from '../components/ConfidenceBadge';
import HowItWorks from '../components/HowItWorks';
import { 
  FileText, ShieldCheck, ShieldAlert, 
  MapPin, Clock, Server, AlertTriangle, Flag, 
  X, Download, CheckCircle, ChevronDown, ChevronUp,
  Info
} from 'lucide-react';

export default function Dashboard() {
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modals state
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  
  // Flag IP form state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [flagRefId, setFlagRefId] = useState('');
  const [flagNotes, setFlagNotes] = useState('');
  const [flagError, setFlagError] = useState('');
  const [flagSuccess, setFlagSuccess] = useState('');
  
  // PDF Report form state
  const [reportRefId, setReportRefId] = useState('');
  const [reportAnalyst, setReportAnalyst] = useState('');
  const [reportOrg, setReportOrg] = useState('Global Cyber Security');
  const [reportError, setReportError] = useState('');

  const handleAnalyze = async ({ method, data }) => {
    setIsLoading(true);
    setErrorMsg('');
    setAnalysisData(null);
    
    try {
      let response;
      if (method === 'paste') {
        response = await axiosInstance.post('/api/analyze', { headers: data });
      } else {
        const formData = new FormData();
        formData.append('file', data);
        response = await axiosInstance.post('/api/analyze', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      }
      setAnalysisData(response.data);
      // Pre-fill Ref ID in forms if headers had a message ID or just default
      const messageId = response.data.headers?.message_id || '';
      const cleanRef = messageId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 20);
      setFlagRefId(cleanRef);
      setReportRefId(cleanRef);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || 'Analysis failed. Please make sure the backend is running and valid headers are supplied.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlagSubmit = async (e) => {
    e.preventDefault();
    setFlagError('');
    setFlagSuccess('');
    
    if (!flagRefId.trim()) {
      setFlagError("Reference ID is required.");
      return;
    }
    if (flagRefId.length > 30) {
      setFlagError("Reference ID must be 30 characters or less.");
      return;
    }
    if (!adminUsername.trim()) {
      setFlagError("Admin username is required.");
      return;
    }
    if (!adminPassword) {
      setFlagError("Admin password is required.");
      return;
    }

    try {
      const payload = {
        ip: analysisData.originating_ip,
        reference_id: flagRefId,
        notes: flagNotes,
        username: adminUsername,
        password: adminPassword
      };
      
      await axiosInstance.post('/api/flag', payload);
      
      setFlagSuccess("IP successfully flagged!");
      setAdminUsername('');
      setAdminPassword('');
      setFlagNotes('');
      
      // Refresh local flagged history for this IP
      const updatedHistory = [
        {
          reference_id: flagRefId,
          notes: flagNotes,
          flagged_at: new Date().toISOString()
        },
        ...analysisData.flagged_history
      ];
      setAnalysisData(prev => ({
        ...prev,
        flagged_history: updatedHistory
      }));
      
      setTimeout(() => {
        setShowFlagModal(false);
        setFlagSuccess('');
      }, 1500);
      
    } catch (err) {
      setFlagError(err.response?.data?.error || 'Flagging IP failed.');
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    setReportError('');
    
    if (!reportRefId.trim()) {
      setReportError("Reference ID is required.");
      return;
    }
    if (reportRefId.length > 30) {
      setReportError("Reference ID must be 30 characters or less.");
      return;
    }
    if (!reportAnalyst.trim()) {
      setReportError("Analyst Name is required.");
      return;
    }

    try {
      const payload = {
        analysis_data: analysisData,
        reference_id: reportRefId,
        analyst_name: reportAnalyst,
        organization: reportOrg
      };
      
      // We expect a Blob file download
      const response = await axiosInstance.post('/api/report', payload, {
        responseType: 'blob'
      });
      
      // Extract file name if possible, or build one
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Extract filename from Content-Disposition header if present
      let filename = `EHA_${reportRefId.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`;
      const disposition = response.headers['content-disposition'];
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '');
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
      setReportError('Failed to generate report.');
    }
  };

  // Authenticity verdict helper
  const getVerdictMarkup = (verdict) => {
    if (!verdict) return null;
    const { label, color } = verdict;
    
    if (color === 'green') {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-5 flex items-center gap-4">
          <div className="bg-green-100 p-3 rounded-full text-green-700">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Security Verdict</span>
            <h3 className="text-base sm:text-xl font-bold text-green-800">{label}</h3>
            <p className="text-[11px] sm:text-xs text-green-600 mt-0.5">The email passes standard authenticity alignment checks.</p>
          </div>
        </div>
      );
    } else if (color === 'amber') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex items-center gap-4">
          <div className="bg-amber-100 p-3 rounded-full text-amber-700">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Security Verdict</span>
            <h3 className="text-base sm:text-xl font-bold text-amber-800">{label}</h3>
            <p className="text-[11px] sm:text-xs text-amber-600 mt-0.5">Some authentication protocols failed or are missing. Treat with caution.</p>
          </div>
        </div>
      );
    } else {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-5 flex items-center gap-4">
          <div className="bg-red-100 p-3 rounded-full text-red-700">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Security Verdict</span>
            <h3 className="text-base sm:text-xl font-bold text-red-800">{label}</h3>
            <p className="text-[11px] sm:text-xs text-red-600 mt-0.5">Critical authentication failures. High probability of sender spoofing.</p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
      <div className="text-center mb-5 sm:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800 tracking-tight flex items-center justify-center gap-2">
          <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-blue-600" />
          Email Header Analyzer
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-xl mx-auto px-2">
          Analyze SMTP relays, SPF/DKIM flags, and originating IP addresses to perform forensics on electronic evidence files.
        </p>
      </div>

      {/* How It Works Section */}
      <HowItWorks />

      {/* Input Section */}
      <HeaderInput onAnalyze={handleAnalyze} isLoading={isLoading} />

      {/* Local Loading Error */}
      {errorMsg && (
        <div className="max-w-4xl mx-auto mt-6 bg-red-50 border border-red-200 text-red-700 rounded-md p-4 flex gap-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Analysis Failed</p>
            <p className="text-xs mt-1 text-red-600">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Analysis Results */}
      {analysisData && (
        <div className="mt-8 space-y-6 max-w-6xl mx-auto">
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4 bg-slate-100 p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Originating IP:</span>
              <span className="font-mono text-xs sm:text-sm font-bold bg-white text-slate-700 border border-slate-350 px-2 py-0.5 rounded shadow-sm break-all">
                {analysisData.originating_ip || 'Not resolved'}
              </span>
            </div>
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 xs:gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded shadow transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                Generate Evidence Report
              </button>
              {analysisData.originating_ip && (
                <button
                  type="button"
                  onClick={() => setShowFlagModal(true)}
                  className="inline-flex items-center justify-center gap-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold py-2 px-4 rounded border border-slate-300 transition-colors cursor-pointer"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Flag this IP
                </button>
              )}
            </div>
          </div>

          {analysisData.provider_notice && (
            <div className="bg-blue-50 border border-blue-200 text-blue-850 rounded-lg p-4 flex gap-3 text-sm select-text shadow-sm">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-0.5">Mail Server Infrastructure Detected</span>
                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                  {analysisData.provider_notice}
                </p>
              </div>
            </div>
          )}

          {/* Verdict and Flagged warnings (Most prominent F-05 / F-08) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
              {getVerdictMarkup(analysisData.authenticity?.verdict)}
            </div>
            
            {/* Spoofing Score Panel */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-center items-center text-center shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Spoofing Risk Score</span>
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-800 mt-2">
                {analysisData.authenticity?.score} <span className="text-base sm:text-lg text-slate-400 font-normal">/ 90</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-4 overflow-hidden">
                <div 
                  className={`h-2 rounded-full ${
                    analysisData.authenticity?.score < 30 ? 'bg-green-500' : analysisData.authenticity?.score < 60 ? 'bg-amber-500' : 'bg-red-500'
                  }`} 
                  style={{ width: `${(analysisData.authenticity?.score / 90) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Registry Flag Check Warning (F-08) */}
          {analysisData.flagged_history && analysisData.flagged_history.length > 0 && (
            <div className="bg-red-50 border-2 border-red-500 rounded-lg p-5 shadow-md">
              <div className="flex items-start gap-3 text-red-800">
                <AlertTriangle className="w-6 h-6 shrink-0 text-red-600 mt-0.5 animate-pulse" />
                <div className="flex-1 select-text">
                  <h4 className="text-base font-bold text-red-950">Previously Flagged Originating IP Detected!</h4>
                  <p className="text-xs mt-1 text-red-700">
                    The originating IP <b>{analysisData.originating_ip}</b> has been explicitly flagged in your local security registry.
                  </p>
                  
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-xs text-left border-collapse border border-red-200">
                      <thead>
                        <tr className="bg-red-100 text-red-950 font-bold border-b border-red-200">
                          <th className="p-2 border-r border-red-200">Reference ID</th>
                          <th className="p-2 border-r border-red-200">Flagged Date</th>
                          <th className="p-2">Analyst Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-red-200 text-red-900 bg-white">
                        {analysisData.flagged_history.map((flag, idx) => (
                          <tr key={idx} className="hover:bg-red-50">
                            <td className="p-2 border-r border-red-200 font-mono font-semibold">{flag.reference_id}</td>
                            <td className="p-2 border-r border-red-200 font-mono">
                              {new Date(flag.flagged_at).toLocaleString()}
                            </td>
                            <td className="p-2 italic">{flag.notes || 'No notes left.'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Email Information Summary */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              1. Email Summary Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3.5 text-xs select-text">
              <div className="flex border-b border-slate-100 pb-2">
                <span className="w-24 font-semibold text-slate-500 shrink-0">From:</span>
                <span className="text-slate-800 break-all">{analysisData.headers.from || 'N/A'}</span>
              </div>
              <div className="flex border-b border-slate-100 pb-2">
                <span className="w-24 font-semibold text-slate-500 shrink-0">To:</span>
                <span className="text-slate-800 break-all">{analysisData.headers.to || 'N/A'}</span>
              </div>
              <div className="flex border-b border-slate-100 pb-2">
                <span className="w-24 font-semibold text-slate-500 shrink-0">Subject:</span>
                <span className="text-slate-800 font-semibold break-all">{analysisData.headers.subject || 'N/A'}</span>
              </div>
              <div className="flex border-b border-slate-100 pb-2">
                <span className="w-24 font-semibold text-slate-500 shrink-0">Date:</span>
                <span className="text-slate-800 break-all">{analysisData.headers.date || 'N/A'}</span>
              </div>
              <div className="flex border-b border-slate-100 pb-2">
                <span className="w-24 font-semibold text-slate-500 shrink-0">Message-ID:</span>
                <span className="text-slate-850 break-all font-mono">{analysisData.headers.message_id || 'N/A'}</span>
              </div>
              <div className="flex border-b border-slate-100 pb-2">
                <span className="w-24 font-semibold text-slate-500 shrink-0">Return-Path:</span>
                <span className="text-slate-800 break-all font-mono">{analysisData.headers.return_path || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Authenticity Flags List (F-05) */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              2. Authentication Flags & Risk Breakdown
            </h3>
            
            <div className="space-y-4">
              {/* SPF Check */}
              <div className="flex flex-col xs:flex-row items-start gap-2 xs:gap-4 p-3 sm:p-4 border border-slate-150 rounded bg-slate-50">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  analysisData.authenticity.details.spf.score === 0 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {analysisData.authenticity.details.spf.status} (+{analysisData.authenticity.details.spf.score})
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-800">Sender Policy Framework (SPF)</h4>
                  <p className="text-xs text-slate-500 mt-1 select-text">{analysisData.authenticity.details.spf.explanation}</p>
                </div>
              </div>

              {/* DKIM Check */}
              <div className="flex flex-col xs:flex-row items-start gap-2 xs:gap-4 p-3 sm:p-4 border border-slate-150 rounded bg-slate-50">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  analysisData.authenticity.details.dkim.score === 0 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {analysisData.authenticity.details.dkim.status} (+{analysisData.authenticity.details.dkim.score})
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-800">DKIM Cryptographic Signature</h4>
                  <p className="text-xs text-slate-500 mt-1 select-text">{analysisData.authenticity.details.dkim.explanation}</p>
                </div>
              </div>

              {/* Domain alignment */}
              <div className="flex flex-col xs:flex-row items-start gap-2 xs:gap-4 p-3 sm:p-4 border border-slate-150 rounded bg-slate-50">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  analysisData.authenticity.details.domain_alignment.score === 0 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {analysisData.authenticity.details.domain_alignment.status} (+{analysisData.authenticity.details.domain_alignment.score})
                </span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-800">Domain Alignment (From vs. Return-Path)</h4>
                  <p className="text-xs text-slate-500 mt-1 select-text">{analysisData.authenticity.details.domain_alignment.explanation}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Geolocation Section (F-03 / F-04) */}
          {analysisData.geolocation && (
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 sm:mb-5 gap-3">
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  3. Originating Geolocation Profile
                </h3>
                <ConfidenceBadge confidence={analysisData.geolocation.confidence} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* Comparison table */}
                <div className="overflow-x-auto border border-slate-200 rounded">
                  <table className="min-w-full text-xs text-left border-collapse select-text">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-2.5 border-r border-slate-200">Field</th>
                        <th className="p-2.5 border-r border-slate-200">ipinfo.io (Primary)</th>
                        <th className="p-2.5">ip-api.com (Secondary)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {['city', 'region', 'country', 'isp', 'lat', 'lon', 'timezone'].map((key) => {
                        const label = key === 'region' ? 'Region/State' : key === 'isp' ? 'ISP / Organization' : key.charAt(0).toUpperCase() + key.slice(1);
                        const val1 = analysisData.geolocation.ipinfo?.[key];
                        const val2 = analysisData.geolocation.ip_api?.[key];
                        
                        // Format coordinates
                        const getValStr = (val) => {
                          if (val === null || val === undefined) return 'N/A';
                          if (typeof val === 'number') return val.toFixed(4);
                          return String(val);
                        };

                        return (
                          <React.Fragment key={key}>
                            <tr className="hover:bg-slate-50">
                              <td className="p-2 border-r border-slate-200 font-semibold text-slate-600 bg-slate-50">{label}</td>
                              <td className="p-2 border-r border-slate-200">{getValStr(val1)}</td>
                              <td className="p-2">{getValStr(val2)}</td>
                            </tr>
                            {key === 'city' && analysisData.provider && (
                              <tr className="bg-blue-50/40">
                                <td colSpan={3} className="p-2 text-[10px] text-slate-500 italic border-b border-slate-200 select-text">
                                  This is {analysisData.provider}'s server location, not the sender's physical location.
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Leaflet Map */}
                <div>
                  <MapWidget 
                    ip={analysisData.originating_ip} 
                    geolocation={analysisData.geolocation} 
                    provider={analysisData.provider} 
                  />
                </div>
              </div>

              {/* Geolocation disclaimer */}
              <div className="mt-4 text-[10px] text-slate-400 bg-slate-50 rounded p-2.5 border border-slate-150 leading-relaxed italic select-text">
                <b>City-Level Disclaimer:</b> City-level accuracy is ~65%. Country and ISP are reliable. For legally admissible subscriber identity, contact the relevant ISP or local authorities.
              </div>
            </div>
          )}

          {/* Mail Server Hop Chain Timeline (F-06) */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 sm:p-6">
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 mb-4 sm:mb-5 flex items-center gap-2">
              <Server className="w-4 h-4 text-slate-500" />
              4. Reconstructed Server Hop Chain
            </h3>
            
            <HopTimeline hops={analysisData.hops} />
          </div>
        </div>
      )}

      {/* FLAG IP MODAL */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center bg-slate-50 border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Flag className="w-4 h-4 text-red-500" />
                Flag Originating IP
              </h3>
              <button onClick={() => { setShowFlagModal(false); setFlagError(''); setAdminUsername(''); setAdminPassword(''); setFlagSuccess(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleFlagSubmit} className="p-5 space-y-4">
              {flagError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{flagError}</span>
                </div>
              )}
              {flagSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded flex items-center gap-2 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{flagSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">IP to Flag</label>
                <input 
                  type="text" 
                  disabled 
                  value={analysisData?.originating_ip || ''} 
                  className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded p-2 text-xs font-mono select-all" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Reference ID <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  maxLength={30}
                  value={flagRefId} 
                  onChange={(e) => setFlagRefId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="e.g. EHA-2026-1049" 
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono" 
                />
                <span className="text-[10px] text-slate-400 block mt-1">Alphanumeric, dashes, underscores. Max 30 chars.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Admin Username <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  value={adminUsername} 
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="Enter admin username" 
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 mb-3" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Admin Password <span className="text-red-500">*</span></label>
                <input 
                  type="password" 
                  required
                  value={adminPassword} 
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password to validate" 
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Notes / Context (Optional)</label>
                <textarea 
                  rows={3}
                  value={flagNotes} 
                  onChange={(e) => setFlagNotes(e.target.value)}
                  placeholder="Describe context of the investigation or spam campaign..." 
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowFlagModal(false); setFlagError(''); setAdminUsername(''); setAdminPassword(''); setFlagSuccess(''); }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  Confirm Registry Flag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EVIDENCE REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center bg-slate-50 border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-500" />
                Generate Evidence Report
              </h3>
              <button onClick={() => { setShowReportModal(false); setReportError(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleReportSubmit} className="p-5 space-y-4">
              {reportError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{reportError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Reference ID <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  maxLength={30}
                  value={reportRefId} 
                  onChange={(e) => setReportRefId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
                  placeholder="e.g. EHA-2026-1049" 
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono" 
                />
                <span className="text-[10px] text-slate-400 block mt-1">Alphanumeric, dashes, underscores. Max 30 chars.</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Analyst Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  value={reportAnalyst} 
                  onChange={(e) => setReportAnalyst(e.target.value)}
                  placeholder="e.g. J. Doe, Investigator" 
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Organization</label>
                <input 
                  type="text" 
                  value={reportOrg} 
                  onChange={(e) => setReportOrg(e.target.value)}
                  placeholder="e.g. Cyber Security Group" 
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setShowReportModal(false); setReportError(''); }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded shadow-sm transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download A4 PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
