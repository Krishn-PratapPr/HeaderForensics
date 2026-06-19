import React, { useState, useRef } from 'react';
import { Upload, FileCode, Clipboard, HelpCircle, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export default function HeaderInput({ onAnalyze, isLoading }) {
  const [activeMethod, setActiveMethod] = useState('paste'); // 'paste' or 'upload'
  const [headersText, setHeadersText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const fileInputRef = useRef(null);
  
  const MAX_SIZE = 100 * 1024; // 100KB in bytes

  const validateText = (text) => {
    if (!text.trim()) {
      return "Please enter email headers.";
    }
    if (new Blob([text]).size > MAX_SIZE) {
      return "Input headers exceed the 100KB size limit.";
    }
    // Check for Received: line (case-insensitive)
    const hasReceived = /(^|\n)Received\s*:/i.test(text);
    if (!hasReceived) {
      return "This does not look like email headers. Please paste raw headers or upload a .eml file.";
    }
    return null;
  };

  const handleTextSubmit = (e) => {
    e.preventDefault();
    setErrorMsg('');
    
    const error = validateText(headersText);
    if (error) {
      setErrorMsg(error);
      return;
    }
    
    onAnalyze({ method: 'paste', data: headersText });
  };

  const handleFileChange = (e) => {
    setErrorMsg('');
    const file = e.target.files[0];
    if (!file) return;

    // Check for screenshot/image types
    if (file.type.startsWith('image/')) {
      setErrorMsg("This does not look like email headers. Please paste raw headers or upload a .eml file.");
      fileInputRef.current.value = '';
      return;
    }

    // Check file extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'eml') {
      setErrorMsg("Please upload a valid .eml file (Screenshots/images are not supported).");
      fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_SIZE) {
      setErrorMsg("The file size exceeds the 100KB limit.");
      fileInputRef.current.value = '';
      return;
    }

    // We pass the file to the parent analyze handler
    onAnalyze({ method: 'upload', data: file });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const file = e.dataTransfer.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setErrorMsg("This does not look like email headers. Please paste raw headers or upload a .eml file.");
      return;
    }

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'eml') {
      setErrorMsg("Please upload a valid .eml file.");
      return;
    }

    if (file.size > MAX_SIZE) {
      setErrorMsg("The file size exceeds the 100KB limit.");
      return;
    }

    onAnalyze({ method: 'upload', data: file });
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-4 sm:mb-6 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto">
        <button
          type="button"
          onClick={() => { setActiveMethod('paste'); setErrorMsg(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
            activeMethod === 'paste'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Clipboard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Paste Headers
        </button>
        <button
          type="button"
          onClick={() => { setActiveMethod('upload'); setErrorMsg(''); }}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
            activeMethod === 'upload'
              ? 'border-blue-600 text-blue-600 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Upload .eml
          <span className="bg-emerald-50 text-emerald-700 text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-200 font-medium hidden xs:inline">
            Recommended
          </span>
        </button>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 rounded-md p-4 mb-4 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Paste Headers Method */}
      {activeMethod === 'paste' && (
        <form onSubmit={handleTextSubmit}>
          <div className="mb-4">
            <label htmlFor="headers-textarea" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Raw Email Headers
            </label>
            <textarea
              id="headers-textarea"
              rows={8}
              className="w-full border border-slate-300 rounded-md p-3 font-mono text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-slate-50"
              placeholder="Paste raw email headers here (containing 'Received: ' lines)..."
              value={headersText}
              onChange={(e) => setHeadersText(e.target.value)}
              disabled={isLoading}
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
              <span>Must contain at least one Received: line</span>
              <span>Max size: 100KB</span>
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isLoading || !headersText.trim()}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 px-6 rounded-md shadow-sm transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Analyzing headers...' : 'Analyze Headers'}
          </button>
        </form>
      )}

      {/* Upload .eml File Method */}
      {activeMethod === 'upload' && (
        <div className="mb-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50 rounded-lg p-5 sm:p-8 text-center cursor-pointer transition-colors"
            onClick={() => fileInputRef.current.click()}
          >
            <FileCode className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <p className="text-sm text-slate-600 font-semibold mb-1">
              Drag & Drop your .eml file here
            </p>
            <p className="text-xs text-slate-400 mb-4">
              or click to browse from your computer (Max size: 100KB)
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".eml"
              className="hidden"
              disabled={isLoading}
            />
            <button
              type="button"
              disabled={isLoading}
              className="bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold py-2 px-4 rounded-md shadow-sm transition-colors"
            >
              Select File
            </button>
          </div>
        </div>
      )}

      {/* Help Section */}
      <div className="border-t border-slate-100 mt-6 pt-4">
        <button
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-sm font-medium transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          <span>How do I get raw headers?</span>
          {showHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        
        {showHelp && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs text-slate-600 border-l-2 border-blue-500 pl-4 py-2">
            <div>
              <h4 className="font-semibold text-slate-800 mb-1.5">Gmail</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open the email.</li>
                <li>Click the <b>More</b> (three dots) next to Reply.</li>
                <li>Click <b>Show original</b>.</li>
                <li>Click <b>Copy to clipboard</b>.</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1.5">Outlook (Web / App)</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open the email.</li>
                <li>Click <b>...</b> (More Actions) &gt; <b>View</b> &gt; <b>View message details</b>.</li>
                <li>Or in app, go to <b>File</b> &gt; <b>Properties</b>.</li>
                <li>Copy text from <b>Internet headers</b>.</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold text-slate-800 mb-1.5">Mozilla Thunderbird</h4>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open the email.</li>
                <li>Press <b>Ctrl + U</b> (View &gt; Message Source).</li>
                <li>Or double-click email &gt; <b>Save As</b> to export as `.eml`.</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
