import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosConfig';
import { 
  Search, Trash2, Download, AlertTriangle, 
  X, CheckCircle, HelpCircle, Calendar 
} from 'lucide-react';

export default function Registry() {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Search parameters state
  const [searchIp, setSearchIp] = useState('');
  const [searchRef, setSearchRef] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // holds the record object to delete
  const [adminPassword, setAdminPassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  const fetchRegistry = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const params = {};
      if (searchIp.trim()) params.ip = searchIp;
      if (searchRef.trim()) params.reference_id = searchRef;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await axiosInstance.get('/api/registry', { params });
      setRecords(response.data);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to fetch flagged IP records from the registry.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on load
  useEffect(() => {
    fetchRegistry();
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRegistry();
  };

  const handleClearFilters = () => {
    setSearchIp('');
    setSearchRef('');
    setStartDate('');
    setEndDate('');
    // We must query immediately after state clears
    // Note: state updates are asynchronous, so we pass empty values to fresh query
    setTimeout(() => {
      fetchRegistry();
    }, 50);
  };

  const handleExportCsv = () => {
    // Generate CSV export URL with current filter query parameters
    let url = `${axiosInstance.defaults.baseURL}/api/registry/export?`;
    const params = [];
    if (searchIp.trim()) params.push(`ip=${encodeURIComponent(searchIp)}`);
    if (searchRef.trim()) params.push(`reference_id=${encodeURIComponent(searchRef)}`);
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    
    url += params.join('&');
    window.open(url, '_blank');
  };

  const handleDeleteSubmit = async (e) => {
    e.preventDefault();
    setDeleteError('');
    setDeleteSuccess('');

    if (!adminPassword) {
      setDeleteError("Admin password is required.");
      return;
    }

    try {
      await axiosInstance.post('/api/registry/delete', {
        id: deleteTarget.id,
        admin_password: adminPassword
      });
      
      setDeleteSuccess("Record successfully deleted!");
      setAdminPassword('');
      
      // Update local list
      setRecords(prev => prev.filter(r => r.id !== deleteTarget.id));
      
      setTimeout(() => {
        setDeleteTarget(null);
        setDeleteSuccess('');
      }, 1500);
      
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete record.');
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">📁 Flagged IP Registry</h1>
          <p className="text-sm text-slate-500 mt-1">
            Search, export, and manage historical evidence flags for malicious originating mail servers.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={records.length === 0}
          className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-2 px-4 rounded shadow transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Export Search as CSV
        </button>
      </div>

      {/* Search Filter Form */}
      <form onSubmit={handleSearchSubmit} className="bg-white border border-slate-200 rounded-lg p-5 mb-6 shadow-sm">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          Search Registry Registry Filters
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-650 uppercase mb-1">IP Address</label>
            <input
              type="text"
              placeholder="e.g. 209.85.220.41"
              value={searchIp}
              onChange={(e) => setSearchIp(e.target.value)}
              className="w-full border border-slate-350 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-650 uppercase mb-1">Reference ID</label>
            <input
              type="text"
              placeholder="e.g. EHA-2026-1049"
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
              className="w-full border border-slate-350 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-650 uppercase mb-1">Start Date</label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-350 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-650 uppercase mb-1">End Date</label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-350 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-5">
          <button
            type="button"
            onClick={handleClearFilters}
            className="px-4 py-2 border border-slate-350 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
          >
            Clear Filters
          </button>
          <button
            type="submit"
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
          >
            Apply Search
          </button>
        </div>
      </form>

      {/* Error / Loading notices */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-4 mb-6 text-sm flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Registry Table List */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden select-text">
        {isLoading ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            <span className="animate-spin inline-block mr-2">⏳</span> Loading registry entries...
          </div>
        ) : records.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No registry records match your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="p-3">IP Address</th>
                  <th className="p-3">Reference ID</th>
                  <th className="p-3">Flagged At</th>
                  <th className="p-3">Analyst Notes</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono font-bold text-slate-800">{record.ip}</td>
                    <td className="p-3 font-mono text-slate-650 font-semibold">{record.reference_id}</td>
                    <td className="p-3 text-slate-500">
                      {new Date(record.flagged_at).toLocaleString()}
                    </td>
                    <td className="p-3 max-w-sm truncate italic text-slate-400" title={record.notes}>
                      {record.notes || '—'}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(record)}
                        className="inline-flex items-center gap-1 text-red-650 hover:text-red-800 hover:bg-red-50 p-1.5 rounded transition-colors cursor-pointer"
                        title="Delete record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DELETE VALIDATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-200 shadow-xl max-w-sm w-full overflow-hidden">
            <div className="flex justify-between items-center bg-slate-50 border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-650" />
                Delete Flag Record
              </h3>
              <button onClick={() => { setDeleteTarget(null); setDeleteError(''); setDeleteSuccess(''); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleDeleteSubmit} className="p-5 space-y-4">
              {deleteError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{deleteError}</span>
                </div>
              )}
              {deleteSuccess && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded flex items-center gap-2 font-medium">
                  <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{deleteSuccess}</span>
                </div>
              )}

              <p className="text-xs text-slate-600">
                Are you sure you want to remove the historical flag for IP <b>{deleteTarget.ip}</b>? This action is permanent.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1">Admin Password <span className="text-red-500">*</span></label>
                <input 
                  type="password" 
                  required
                  value={adminPassword} 
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter secret key to authorize delete" 
                  className="w-full border border-slate-300 rounded p-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500" 
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => { setDeleteTarget(null); setDeleteError(''); setDeleteSuccess(''); }}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded shadow-sm transition-colors cursor-pointer"
                >
                  Delete Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
