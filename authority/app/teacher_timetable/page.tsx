"use client";

import { useState } from "react";

interface TimetableEntry {
  timetable_id: string;
  day_of_week: string;
  time_slot: {
    slot_name: string;
    start_time: string;
    end_time: string;
  };
  subject: {
    subject_name: string;
    subject_code: string;
  };
  classroom: {
    room_number: string;
  };
  section: {
    section_name: string;
  };
  batch: {
    batch_name: string;
  };
}

const DAYS_OF_WEEK = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

export default function TeacherTimetablePage() {
  const [teacherId, setTeacherId] = useState("");
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimetable = async () => {
    if (!teacherId.trim()) return;

    setLoading(true);
    setError(null);
    setTimetable([]);

    try {
      const response = await fetch(`/api/fetch_teacher_time_table?teacher_id=${teacherId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch data");
      }

      const data = await response.json();
      console.log("Raw API Response Timetable Data:", data);
      setTimetable(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please check the Teacher ID and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchTimetable();
    }
  };

  // Group entries by day — normalize to uppercase on both sides to avoid case mismatch
  const timetableByDay: Record<string, TimetableEntry[]> = {};
  DAYS_OF_WEEK.forEach((day) => {
    timetableByDay[day] = timetable.filter(
      (entry) => entry.day_of_week?.toUpperCase() === day
    );
    timetableByDay[day].sort((a, b) => a.time_slot.slot_name.localeCompare(b.time_slot.slot_name));
  });

  // How many entries actually matched a known day
  const matchedCount = DAYS_OF_WEEK.reduce((acc, day) => acc + timetableByDay[day].length, 0);
  const hasUnmatchedEntries = timetable.length > 0 && matchedCount === 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="h-12 w-1 bg-amber-500 rounded-full"></div>
             <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
               Faculty Timetable System
               <span className="block text-lg font-medium text-slate-500 mt-1 italic opacity-80 underline decoration-indigo-500/30">Weekly Schedule & Class Locations</span>
             </h1>
          </div>
        </div>

        {/* Search Control */}
        <div className="group relative max-w-md">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 via-indigo-500 to-amber-600 rounded-xl blur opacity-25 group-focus-within:opacity-50 transition-duration-500"></div>
          <div className="relative flex gap-3 p-1.5 bg-slate-900 ring-1 ring-white/10 rounded-xl shadow-2xl">
            <input
              type="text"
              placeholder="Enter Faculty ID"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent px-4 py-3 outline-none text-white font-medium placeholder:text-slate-600"
            />
            <button
              onClick={fetchTimetable}
              disabled={loading}
              className="px-8 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all active:scale-95 shadow-lg shadow-amber-500/20"
            >
              {loading ? "..." : "Retrieve"}
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl animate-in slide-in-from-top-4 duration-500">
             <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
             <span className="font-semibold text-sm">{error}</span>
          </div>
        )}

        {/* Content Section */}
        <div className="grid gap-8 items-start">
           {!loading && timetable.length === 0 && !error && teacherId && (
             <div className="py-24 text-center border-2 border-dashed border-slate-800/50 rounded-3xl group hover:border-amber-500/30 transition-colors">
                <p className="text-slate-500 text-lg">No <span className="text-amber-400">scheduled</span> classes for <span className="text-indigo-400 font-mono">#{teacherId}</span></p>
             </div>
           )}

           {/* Fallback: show raw table if day_of_week values don't match known days */}
           {hasUnmatchedEntries && (
             <div className="animate-in fade-in duration-500 space-y-4">
               <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                 <svg className="h-4 w-4 text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <p className="text-xs text-amber-400 font-medium">
                   Data received ({timetable.length} entries) — day values in DB: <span className="font-mono">{[...new Set(timetable.map(e => e.day_of_week))].join(", ")}</span>
                 </p>
               </div>
               <div className="overflow-hidden rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/5 shadow-2xl">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="border-b border-white/5 bg-slate-800/20 text-slate-500 text-xs uppercase tracking-wider">
                       <th className="px-6 py-4">Day</th>
                       <th className="px-6 py-4">Slot</th>
                       <th className="px-6 py-4">Subject</th>
                       <th className="px-6 py-4">Batch / Section</th>
                       <th className="px-6 py-4">Room</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {timetable.map((session) => (
                       <tr key={session.timetable_id} className="hover:bg-white/5 transition-colors">
                         <td className="px-6 py-4 font-mono text-amber-400 text-xs">{session.day_of_week}</td>
                         <td className="px-6 py-4 text-xs font-bold text-indigo-400">{session.time_slot?.slot_name}</td>
                         <td className="px-6 py-4">
                           <div className="text-sm font-bold text-slate-200">{session.subject?.subject_name}</div>
                           <div className="text-[10px] font-mono text-slate-500">{session.subject?.subject_code}</div>
                         </td>
                         <td className="px-6 py-4 text-xs text-slate-400">{session.batch?.batch_name} / Sec {session.section?.section_name}</td>
                         <td className="px-6 py-4 text-xs text-slate-400">{session.classroom?.room_number || "TBA"}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
           )}

           {timetable.length > 0 && !hasUnmatchedEntries && (
             <div className="grid gap-8 animate-in mt-4 fade-in slide-in-from-bottom-4 duration-700 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {DAYS_OF_WEEK.map((day) => {
                  const sessions = timetableByDay[day];
                  if (sessions.length === 0) return null;
                  
                  return (
                    <div key={day} className="flex flex-col rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/5 shadow-2xl overflow-hidden">
                      <div className="bg-slate-800/50 border-b border-white/5 px-6 py-4">
                        <h3 className="text-xl font-bold text-slate-200 capitalize tracking-wide">{day.toLowerCase()}</h3>
                        <p className="text-[10px] text-slate-500 mt-1">{sessions.length} class{sessions.length > 1 ? 'es' : ''}</p>
                      </div>
                      <div className="divide-y divide-white/5 flex-1 p-2">
                         {sessions.map((session) => {
                            let startTimeStr = session.time_slot?.start_time ?? "";
                            let endTimeStr = session.time_slot?.end_time ?? "";
                            if (startTimeStr && startTimeStr.includes('T')) {
                              startTimeStr = new Date(startTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            } else if (startTimeStr.length >= 5) {
                              startTimeStr = startTimeStr.substring(0, 5);
                            }
                            if (endTimeStr && endTimeStr.includes('T')) {
                              endTimeStr = new Date(endTimeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            } else if (endTimeStr.length >= 5) {
                              endTimeStr = endTimeStr.substring(0, 5);
                            }

                            return (
                              <div key={session.timetable_id} className="p-4 rounded-xl hover:bg-white/5 transition-colors group">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                                    {session.time_slot?.slot_name}
                                  </span>
                                  <span className="text-xs font-mono text-amber-500/80 group-hover:text-amber-400 transition-colors flex items-center gap-1">
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    {session.classroom?.room_number || "TBA"}
                                  </span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-200 group-hover:text-indigo-300 transition-colors mb-1">
                                  {session.subject?.subject_name}
                                  <span className="text-[10px] font-mono text-slate-500 ml-2">({session.subject?.subject_code})</span>
                                </h4>
                                <div className="flex justify-between items-center mt-3">
                                  <p className="text-xs text-slate-500 font-medium tracking-wide">
                                    {session.batch?.batch_name} • <span className="text-slate-400">Sec {session.section?.section_name}</span>
                                  </p>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    {startTimeStr} {endTimeStr ? `- ${endTimeStr}` : ""}
                                  </div>
                                </div>
                              </div>
                            );
                         })}
                      </div>
                    </div>
                  );
                })}
             </div>
           )}
        </div>

        {/* Footer Stats */}
        {timetable.length > 0 && (
          <div className="flex justify-between items-center px-2 pt-4 border-t border-white/5">
             <div className="text-[10px] text-slate-600 uppercase font-black tracking-widest">
                Data Stream: Live • Terminal Sync: OK
             </div>
             <p className="text-xs text-slate-500">
               Total Classes: <span className="text-amber-500 font-bold">{timetable.length}</span>
             </p>
          </div>
        )}

      </div>
    </div>
  );
}
