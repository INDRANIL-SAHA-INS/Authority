"use client";

import React, { useState, useRef, useMemo } from "react";

interface ExtractionResult {
  success: boolean;
  filename: string;
  file_type: string;
  metadata: Record<string, any>;
  total_records: number;
  records: Array<Record<string, any>>;
}

export default function MarksUploadPage() {
  // State
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Computed: Filtered Records
  const filteredRecords = useMemo(() => {
    if (!result) return [];
    if (!searchQuery) return result.records;
    
    const query = searchQuery.toLowerCase();
    return result.records.filter((record) => 
      Object.values(record).some(val => 
        String(val).toLowerCase().includes(query)
      )
    );
  }, [result, searchQuery]);

  // Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8001/api/marks/extract", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Failed to extract marks");
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-slate-200 font-sans selection:bg-teal-500/30">
      {/* Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-teal-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto p-4 md:p-8 flex flex-col h-screen">
        {/* Header */}
        <header className="flex justify-between items-center mb-8 shrink-0">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <span className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-teal-400 rounded-lg flex items-center justify-center text-white text-lg shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                A
              </span>
              AUTHORITY <span className="text-slate-500 font-light">EXTRACTOR</span>
            </h1>
          </div>
          {result && (
            <button 
              onClick={reset}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 rounded-full text-xs font-medium transition-all"
            >
              Start New Extraction
            </button>
          )}
        </header>

        {!result && !loading ? (
          /* INITIAL STATE: Upload Centered */
          <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
            <div className="text-center mb-10">
              <h2 className="text-4xl font-bold text-white mb-4">Process Academic Records</h2>
              <p className="text-slate-400">Upload your PDF or Spreadsheet to automatically extract structured marks data.</p>
            </div>

            <div
              className={`w-full relative group transition-all duration-500 ${
                dragActive ? "scale-[1.02]" : ""
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className={`absolute -inset-1 bg-gradient-to-r from-indigo-500 to-teal-500 rounded-[2rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200 ${dragActive ? 'opacity-60' : ''}`} />
              
              <div className={`relative bg-[#0d0f14] border border-slate-800/50 rounded-[2rem] p-12 flex flex-col items-center text-center transition-all cursor-pointer ${dragActive ? 'border-indigo-500/50 bg-indigo-500/5' : ''}`} onClick={() => !file && fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.csv,.xlsx,.xls" onChange={handleFileChange} />
                
                <div className={`mb-8 w-24 h-24 rounded-3xl bg-slate-800/50 flex items-center justify-center text-indigo-400 transition-all duration-500 ${dragActive ? 'rotate-12 scale-110 bg-indigo-500/20' : 'group-hover:-translate-y-2'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>

                <h3 className="text-2xl font-semibold text-white mb-2">
                  {file ? file.name : "Drop your document here"}
                </h3>
                <p className="text-slate-500 mb-8 max-w-[280px]">
                  Supports multi-page PDFs, complex Excel tables, and standard CSVs.
                </p>

                {!file ? (
                  <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-white text-black font-bold rounded-2xl hover:bg-slate-200 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.1)] cursor-pointer">
                    Choose File
                  </button>
                ) : (
                  <div className="flex gap-3">
                     <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-all cursor-pointer">
                      Change
                    </button>
                    <button onClick={handleUpload} className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-teal-500 text-white font-bold rounded-xl hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transition-all cursor-pointer">
                      Process Now
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {error && (
              <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}
          </div>
        ) : loading ? (
          /* LOADING STATE: Full Screen Minimal */
          <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-700">
            <div className="relative w-32 h-32 mb-10">
              <div className="absolute inset-0 border-4 border-slate-800 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-4 bg-gradient-to-br from-indigo-500 to-teal-400 rounded-full blur-xl opacity-20 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Analyzing Document Structure</h2>
            <p className="text-slate-500 animate-pulse">Extracting records and normalizing headers...</p>
          </div>
        ) : (
          /* RESULT STATE: Dashboard Layout */
          <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden animate-in slide-in-from-bottom-8 duration-700">
            {/* Sidebar: Summary & Metadata */}
            <aside className="w-full lg:w-[320px] flex flex-col gap-6 shrink-0 overflow-y-auto pr-2 custom-scrollbar">
              {/* Stats Card */}
              <div className="bg-[#0d0f14]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6">Extraction Summary</h3>
                <div className="space-y-6">
                  <div>
                    <div className="text-4xl font-black text-white">{result?.total_records}</div>
                    <div className="text-sm text-slate-500">Records Detected</div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/10">
                      <div className="text-xs text-indigo-400 font-bold mb-1 uppercase">File</div>
                      <div className="text-sm text-white truncate font-medium">{result?.file_type}</div>
                    </div>
                    <div className="flex-1 p-3 bg-teal-500/10 rounded-2xl border border-teal-500/10">
                      <div className="text-xs text-teal-400 font-bold mb-1 uppercase">Status</div>
                      <div className="text-sm text-white font-medium">Verified</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metadata Card */}
              <div className="flex-1 bg-[#0d0f14]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl p-6 overflow-hidden flex flex-col">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 shrink-0">Metadata Details</h3>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                  {Object.entries(result?.metadata || {}).map(([key, value]) => (
                    <div key={key} className="group">
                      <div className="text-[10px] text-slate-600 font-bold uppercase mb-1 group-hover:text-indigo-400 transition-colors">
                        {key.replace(/_/g, " ")}
                      </div>
                      <div className="text-sm text-slate-300 break-words leading-relaxed">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                  {Object.keys(result?.metadata || {}).length === 0 && (
                    <div className="text-slate-600 italic text-sm py-4">No metadata detected in document.</div>
                  )}
                </div>
              </div>
            </aside>

            {/* Main Content: Table Dashboard */}
            <main className="flex-1 bg-[#0d0f14]/80 backdrop-blur-xl border border-slate-800/50 rounded-3xl flex flex-col overflow-hidden shadow-2xl min-w-0">
              {/* Table Controls */}
              <div className="p-6 border-b border-slate-800/50 flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
                <div className="relative w-full sm:w-[400px]">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input 
                    type="text" 
                    placeholder="Search students, USN, or marks..." 
                    className="w-full bg-slate-900/50 border border-slate-800 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 rounded-2xl py-3 pl-12 pr-4 text-sm transition-all outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex gap-2 shrink-0">
                  <button 
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(result?.records, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `extracted_${result?.filename.split('.')[0]}.json`;
                      a.click();
                    }}
                    className="px-5 py-3 bg-white text-black font-bold rounded-2xl text-sm flex items-center gap-2 hover:bg-slate-200 transition-all shadow-lg cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download JSON
                  </button>
                </div>
              </div>

              {/* Data Table Container - Robust Scrolling */}
              <div className="flex-1 overflow-auto custom-scrollbar-v relative">
                {filteredRecords.length > 0 ? (
                  <table className="w-max min-w-full text-left border-collapse table-auto">
                    <thead className="sticky top-0 bg-[#0d0f14] z-20">
                      <tr>
                        {Object.keys(result?.records[0] || {}).map((key) => (
                          <th key={key} className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800/50 bg-[#0d0f14]/80 backdrop-blur-md whitespace-nowrap">
                            {key.replace(/_/g, " ")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-800/30">
                      {filteredRecords.map((row, i) => (
                        <tr key={i} className="hover:bg-indigo-500/[0.03] group transition-colors cursor-default">
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-6 py-4 text-slate-400 group-hover:text-slate-100 transition-colors whitespace-nowrap min-w-[150px]">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 p-12">
                    <svg className="mb-4 opacity-20" xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <p>No records matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
              
              {/* Footer / Summary Bar */}
              <div className="p-4 bg-slate-900/30 border-t border-slate-800/50 flex justify-between items-center text-[10px] font-bold text-slate-600 uppercase tracking-widest shrink-0">
                <div>Showing {filteredRecords.length} of {result?.total_records} records</div>
                <div>Authority Data Engine v1.0</div>
              </div>
            </main>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar-v::-webkit-scrollbar {
          width: 8px;
          height: 10px; /* Thicker horizontal scrollbar */
        }
        .custom-scrollbar-v::-webkit-scrollbar-track {
          background: rgba(15, 17, 23, 0.5);
          border-radius: 10px;
        }
        .custom-scrollbar-v::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 10px;
          border: 2px solid #0f1117;
        }
        .custom-scrollbar-v::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
        
        /* Ensure horizontal scroll is always possible when content overflows */
        .overflow-auto {
          scrollbar-width: auto;
          -ms-overflow-style: auto;
        }
        
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
        .animate-slide-up { animation: slide-up 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
