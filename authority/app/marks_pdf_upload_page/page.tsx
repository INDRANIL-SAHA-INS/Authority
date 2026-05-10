"use client";

import React, { useState } from "react";
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  BookOpen,
  Users,
  Layout
} from "lucide-react";

export default function MarksUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examType, setExamType] = useState("INTERNAL_1");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string, jobId?: string } | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !sectionId || !subjectId) return;

    setLoading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("sectionId", sectionId);
    formData.append("subjectId", subjectId);
    formData.append("examType", examType);

    try {
      const response = await fetch("/api/teacher/marks_upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setStatus({
          type: 'success',
          message: "Upload started successfully! AI is now processing your file.",
          jobId: result.jobId
        });
        // Reset form
        setFile(null);
      } else {
        setStatus({
          type: 'error',
          message: result.message || "Failed to initiate upload."
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: "An unexpected error occurred."
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C10] text-white p-6 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-3">
            AI Marks Extraction
          </h1>
          <p className="text-slate-400 text-lg">
            Upload your PDF or Excel marks sheets and let our AI handle the mapping and database entry.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Column: Form */}
          <div className="lg:col-span-3 space-y-6">
            <form onSubmit={handleUpload} className="bg-[#161B22] border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Section Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
                    <Users size={16} /> Section ID
                  </label>
                  <input
                    type="text"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    placeholder="e.g. 101"
                    className="w-full bg-[#0D1117] border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    required
                  />
                </div>

                {/* Subject Selection */}
                <div>
                  <label className="block text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
                    <BookOpen size={16} /> Subject ID
                  </label>
                  <input
                    type="text"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full bg-[#0D1117] border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    required
                  />
                </div>

                {/* Exam Type */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-400 mb-2 flex items-center gap-2">
                    <Layout size={16} /> Examination Type
                  </label>
                  <select
                    value={examType}
                    onChange={(e) => setExamType(e.target.value)}
                    className="w-full bg-[#0D1117] border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                  >
                    <option value="INTERNAL_1">Internal Assessment 1</option>
                    <option value="INTERNAL_2">Internal Assessment 2</option>
                    <option value="MID_TERM">Mid-Term Examination</option>
                    <option value="END_TERM">End-Term Examination</option>
                  </select>
                </div>
              </div>

              {/* File Dropzone */}
              <div 
                className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all ${
                  file ? 'border-blue-500 bg-blue-500/5' : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.csv,.xlsx,.xls"
                />
                <div className="flex flex-col items-center">
                  <div className="p-4 bg-slate-800 rounded-2xl mb-4">
                    <Upload className={file ? 'text-blue-400' : 'text-slate-400'} size={32} />
                  </div>
                  {file ? (
                    <div>
                      <p className="text-blue-400 font-bold text-lg mb-1">{file.name}</p>
                      <p className="text-slate-500 text-sm">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-slate-200 mb-2">Drop your marks sheet here</p>
                      <p className="text-slate-500 text-sm">Supports PDF, Excel, and CSV formats</p>
                    </>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !file || !sectionId || !subjectId}
                className="w-full mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1 active:translate-y-0"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Processing with AI...
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    Initiate Extraction
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Column: Status & Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Card */}
            {status && (
              <div className={`p-6 rounded-3xl border animate-in fade-in slide-in-from-right-4 duration-500 ${
                status.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                <div className="flex items-start gap-4">
                  {status.type === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                  <div>
                    <p className="font-bold text-lg mb-2">{status.type === 'success' ? 'Request Sent' : 'Upload Failed'}</p>
                    <p className="text-slate-300 leading-relaxed mb-4">{status.message}</p>
                    {status.jobId && (
                      <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                        <p className="text-xs text-slate-400 mb-1 uppercase tracking-wider font-bold">Job Reference ID</p>
                        <code className="text-white font-mono text-xs break-all">{status.jobId}</code>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Guidelines Card */}
            <div className="bg-[#161B22] border border-slate-800 rounded-3xl p-8">
              <h3 className="font-bold text-xl mb-4 flex items-center gap-2">
                <FileText size={20} className="text-blue-400" /> Instructions
              </h3>
              <ul className="space-y-4 text-slate-400 text-sm">
                <li className="flex gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  Ensure the PDF has clear headers for USN/Roll No and Marks.
                </li>
                <li className="flex gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  The AI will automatically handle messy column names like "Assign_1" or "Q1".
                </li>
                <li className="flex gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  "AB" or empty cells will be recorded as Absent.
                </li>
                <li className="flex gap-3">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  Processing takes 5-10 seconds depending on file size.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
