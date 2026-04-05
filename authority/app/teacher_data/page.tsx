"use client";

import { useState } from "react";

interface Subject {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  subject_type: string;
}

interface Student {
  student_id: string;
  university_roll_number: string;
  first_name: string;
  last_name: string;
  email: string;
  student_status: string;
}

interface Batch {
  batch_name: string;
}

interface Section {
  section_name: string;
  students: Student[];
}

interface Period {
  period_id: string;
  name: string;
  academic_year: string;
}

interface Assignment {
  assignment_id: string;
  subject: Subject;
  batch: Batch;
  section: Section;
  period: Period;
  assignment_role: string;
  assignment_status: string;
  assigned_hours_per_week: number;
}

export default function TeacherSubjectsPage() {
  const [teacherId, setTeacherId] = useState("");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSubjects = async () => {
    if (!teacherId.trim()) return;

    setLoading(true);
    setError(null);
    setAssignments([]);
    setSelectedAssignment(null);

    try {
      const response = await fetch(`/api/fetch_teacher_sub?teacher_id=${teacherId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch data");
      }

      const data = await response.json();
      
      // Log raw data to console as requested
      console.log("Raw API Response Student Data:", data);
      
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please check the Teacher ID and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchSubjects();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="h-12 w-1 bg-amber-500 rounded-full"></div>
             <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
               Faculty Record System
               <span className="block text-lg font-medium text-slate-500 mt-1 italic opacity-80 underline decoration-indigo-500/30">Active Subject Assignments & Student Rosters</span>
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
              onClick={fetchSubjects}
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Assignments List */}
          <div className={`space-y-6 ${selectedAssignment ? 'lg:col-span-7' : 'lg:col-span-12'} transition-all duration-500`}>
             {!loading && assignments.length === 0 && !error && teacherId && (
               <div className="py-24 text-center border-2 border-dashed border-slate-800/50 rounded-3xl group hover:border-amber-500/30 transition-colors">
                  <p className="text-slate-500 text-lg">No <span className="text-amber-400">active</span> assignments for <span className="text-indigo-400 font-mono">#{teacherId}</span></p>
               </div>
             )}

             {assignments.length > 0 && (
               <div className="grid gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                 <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 -mb-4">Active Assignments</h2>
                 <div className="overflow-hidden rounded-3xl bg-slate-900/40 backdrop-blur-md border border-white/5 shadow-2xl">
                   <table className="w-full text-left border-collapse">
                     <thead>
                       <tr className="border-b border-white/5 bg-slate-800/20 font-semibold text-slate-500 text-xs uppercase tracking-wider">
                         <th className="px-8 py-5">Subject</th>
                         <th className="px-6 py-5">Batch/Section</th>
                         <th className="px-8 py-5 text-right">Status</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-white/5">
                       {assignments.map((item) => (
                         <tr 
                           key={item.assignment_id} 
                           onClick={() => setSelectedAssignment(item)}
                           className={`cursor-pointer transition-all group ${selectedAssignment?.assignment_id === item.assignment_id ? 'bg-indigo-500/10' : 'hover:bg-white/5'}`}
                         >
                           <td className="px-8 py-6">
                             <div className="font-bold text-slate-200 group-hover:text-amber-400 transition-colors">
                               {item.subject.subject_name}
                             </div>
                             <div className="text-[10px] font-mono mt-1 text-slate-500">
                               {item.subject.subject_code} • {item.subject.subject_type}
                             </div>
                           </td>
                           <td className="px-6 py-6">
                             <div className="text-sm font-semibold text-slate-300">{item.batch.batch_name}</div>
                             <div className="text-xs text-slate-500 mt-1">Section {item.section.section_name}</div>
                           </td>
                           <td className="px-8 py-6 text-right">
                             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20">
                               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                               {item.assignment_status}
                             </span>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             )}
          </div>

          {/* Student Roster (Conditional) */}
          {selectedAssignment && (
            <div className="lg:col-span-5 animate-in slide-in-from-right-8 fade-in duration-500">
              <div className="sticky top-8 space-y-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-amber-500">Student Roster</h3>
                   <button 
                     onClick={() => setSelectedAssignment(null)}
                     className="text-xs text-slate-500 hover:text-white transition-colors flex items-center gap-1"
                   >
                     Clear Selection ✕
                   </button>
                </div>
                
                <div className="bg-slate-900 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                   <div className="p-6 bg-slate-800/30 border-b border-white/5">
                      <div className="text-xs font-black text-indigo-400 uppercase tracking-tighter mb-1">Current Class</div>
                      <div className="text-lg font-bold text-slate-200">
                        {selectedAssignment.subject.subject_name} 
                        <span className="text-slate-500 font-medium ml-2">({selectedAssignment.section.section_name})</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{selectedAssignment.batch.batch_name} • {selectedAssignment.section.students.length} Total Students</p>
                   </div>
                   
                   <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                      {selectedAssignment.section.students.length === 0 ? (
                        <div className="p-12 text-center text-slate-600 italic text-sm">No students enrolled in this section.</div>
                      ) : (
                        <div className="divide-y divide-white/5">
                          {selectedAssignment.section.students.map((student) => (
                            <div key={student.student_id} className="p-4 hover:bg-white/5 flex items-center gap-4 group">
                               <div className="h-10 w-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                  {student.first_name[0]}
                               </div>
                               <div className="flex-1 min-w-0">
                                  <div className="text-sm font-bold text-slate-300 truncate">{student.first_name} {student.last_name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate tracking-tighter italic">Roll: {student.university_roll_number}</div>
                               </div>
                               <div className="text-[10px] font-black text-emerald-500/50 group-hover:text-emerald-400 transition-colors">
                                  {student.student_status}
                               </div>
                            </div>
                          ))}
                        </div>
                      )}
                   </div>
                   <div className="p-4 bg-slate-800/10 border-t border-white/5 text-[10px] text-center text-slate-600 uppercase font-black tracking-widest">
                      End of Roster
                   </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        {assignments.length > 0 && (
          <div className="flex justify-between items-center px-2 pt-4 border-t border-white/5">
             <div className="text-[10px] text-slate-600 uppercase font-black tracking-widest">
                Data Stream: Live • Terminal Sync: OK
             </div>
             <p className="text-xs text-slate-500">
               Active Assignments: <span className="text-amber-500 font-bold">{assignments.length}</span>
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
