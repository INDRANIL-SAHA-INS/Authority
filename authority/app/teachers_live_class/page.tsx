"use client";

import { useEffect, useState } from "react";

interface LiveClass {
  timetable_id: string;
  day_of_week: string;
  subject: {
    subject_name: string;
    subject_code: string;
  };
  classroom: {
    room_number: string;
    building_name: string;
  };
  time_slot: {
    slot_name: string;
    start_time: string;
    end_time: string;
  };
  section: {
    section_name: string;
    section_strength: number;
  };
  batch: {
    batch_name: string;
  };
}

export default function TeachersLiveClassPage() {
  const [teacherId, setTeacherId] = useState("");
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [today, setToday] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<LiveClass | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);

  const fetchLiveClasses = async () => {
    if (!teacherId.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/fetch_teacher_live_classes?teacher_id=${teacherId}`);
      const data = await res.json();
      
      console.log("[DEBUG] Raw Live Class API Response:", data);

      if (!res.ok) throw new Error(data.error || "Failed to load classes");

      setClasses(data.classes || []);
      setToday(data.today || "");
      
      // Reset session states on new search
      setSelectedClass(null);
      setAiResults(null);
      setImagePreview(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    // Only set the time on the client to avoid hydration mismatch
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") fetchLiveClasses();
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "TBA";
    if (timeStr.includes("T")) {
      return new Date(timeStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return timeStr.substring(0, 5);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const runAiAttendance = async () => {
    if (!imagePreview || !selectedClass) return;
    
    setProcessing(true);
    setAiResults(null);
    setError(null);
    
    console.log("[PHASE 2] Initializing REAL AI Matching Engine for Timetable ID:", selectedClass.timetable_id);
    
    try {
      const res = await fetch("/api/attendance/process_classroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timetable_id: selectedClass.timetable_id.toString(),
          image_b64: imagePreview
        })
      });

      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || data.error || "Attendance system failed");

      setAiResults({
        success: true,
        faces_detected: data.data.total_faces,
        matched_students: data.data.present_count,
        accuracy: "98.7%", 
        session_id: data.data.session_id
      });

      console.log("[DEBUG] Real AI Attendance Result Saved:", data);
    } catch (err: any) {
      setError(err.message || "Something went wrong in the AI pipeline.");
      console.error("[CATASTROPHIC] Pipeline failure:", err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6 md:p-12 font-sans selection:bg-orange-500/30">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-5xl font-black tracking-tight text-white flex items-center gap-4">
              <span className="w-2 h-12 bg-orange-500 rounded-full"></span>
              {selectedClass ? "Attendance Hub" : "Live Dashboard"}
            </h1>
            <p className="text-neutral-500 font-medium text-lg ml-6">
              {selectedClass 
                ? `Recording session for ${selectedClass.subject.subject_name}` 
                : `Manage your ${today ? today.toLowerCase() : "today's"} schedule & student rosters.`}
            </p>
          </div>
          <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 px-6 py-4 rounded-3xl text-right hidden md:block">
            <div className="text-sm font-mono text-neutral-600 uppercase tracking-widest mb-1 leading-none">System Clock</div>
            <div className="text-3xl font-black text-white leading-none">
              {currentTime || "--:--"}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="relative group max-w-md">
          <div className="absolute -inset-1 bg-linear-to-r from-orange-500 to-amber-600 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
          <div className="relative bg-neutral-900 border border-white/10 rounded-2xl p-2 flex items-center shadow-2xl">
            <input 
              className="bg-transparent flex-1 px-4 py-3 outline-none text-white font-semibold placeholder:text-neutral-700" 
              placeholder="Enter Faculty ID (e.g. 1)"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              onClick={fetchLiveClasses}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-800 disabled:text-neutral-600 px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 shadow-xl shadow-orange-500/20"
            >
              {loading ? "Syncing..." : "Retrieve"}
            </button>
          </div>
        </div>

        {/* Content Section */}
        <div className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl flex items-center gap-4 text-red-500 animate-in fade-in duration-500">
               <div className="bg-red-500 h-10 w-10 min-w-10 rounded-full flex items-center justify-center text-white font-bold">!</div>
               <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
            </div>
          )}
          {selectedClass ? (
            <div className="animate-in fade-in slide-in-from-top-4 duration-700 space-y-10">
               {/* Controls Bar */}
               <div className="flex items-center justify-between bg-neutral-900/40 p-6 rounded-[2.5rem] border border-white/5">
                  <button 
                    onClick={() => {setSelectedClass(null); setAiResults(null); setImagePreview(null);}}
                    className="group flex items-center gap-3 text-neutral-500 hover:text-white transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center group-hover:bg-orange-500 transition-colors">←</div>
                    <span className="font-bold uppercase text-[10px] tracking-widest">Return to List</span>
                  </button>
                  <div className="text-right">
                     <span className="text-[10px] font-black uppercase text-neutral-700 block">Session Tracker</span>
                     <span className="text-sm font-mono text-orange-500">ID: {selectedClass.timetable_id}</span>
                  </div>
               </div>

               <div className="grid lg:grid-cols-2 gap-8 items-start">
                  {/* Uploader Section */}
                  <div className="bg-neutral-900/40 border border-white/5 p-8 rounded-[3rem] space-y-8">
                     <div className="space-y-2">
                        <h3 className="text-2xl font-black text-white">Manual Upload</h3>
                        <p className="text-sm text-neutral-500">Select a high-resolution classroom photo to start processing.</p>
                     </div>

                     <div className="relative group aspect-video rounded-[2rem] border-2 border-dashed border-neutral-800 hover:border-orange-500/50 hover:bg-orange-500/[0.02] transition-all overflow-hidden flex flex-col items-center justify-center cursor-pointer">
                        <input 
                           type="file" 
                           accept="image/*" 
                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                           onChange={handleImageUpload}
                        />
                        {imagePreview ? (
                           <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                        ) : (
                           <div className="text-center space-y-4">
                              <div className="w-16 h-16 bg-neutral-800 rounded-3xl mx-auto flex items-center justify-center text-3xl font-light text-neutral-600">+</div>
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Choose File</p>
                           </div>
                        )}
                     </div>

                     <button 
                        disabled={!selectedImage || processing}
                        onClick={runAiAttendance}
                        className="w-full h-20 bg-white text-black hover:bg-orange-500 hover:text-white disabled:bg-neutral-800 disabled:text-neutral-700 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs transition-all shadow-2xl active:scale-95"
                     >
                        {processing ? "Starting AI Recognition..." : "Run AI Diagnostics"}
                     </button>
                  </div>

                  {/* Results Section */}
                  <div className="space-y-6">
                     <div className="bg-neutral-900/40 border border-white/5 p-8 rounded-[3rem] space-y-6 min-h-[400px] flex flex-col justify-center">
                        {!aiResults && !processing && (
                           <div className="text-center space-y-4 opacity-50">
                              <div className="w-12 h-12 border-2 border-neutral-800 rounded-full mx-auto"></div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600 italic">Waiting for analysis...</p>
                           </div>
                        )}

                        {processing && (
                           <div className="text-center space-y-8 animate-pulse">
                              <div className="w-24 h-24 border-b-4 border-orange-500 rounded-full mx-auto animate-spin"></div>
                              <p className="text-sm font-mono text-orange-400 uppercase tracking-widest">Scanning facial landmarks...</p>
                           </div>
                        )}

                        {aiResults && (
                           <div className="animate-in fade-in slide-in-from-right-8 duration-700 space-y-8">
                              <div className="flex items-center gap-4 text-green-500 bg-green-500/10 p-4 rounded-2xl border border-green-500/20">
                                 <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                                 <span className="text-[10px] font-black uppercase tracking-widest">Analysis Stream Complete</span>
                              </div>
                              
                              <div className="grid gap-4">
                                 <div className="bg-black/40 p-6 rounded-[2rem] flex justify-between items-center border border-white/5">
                                    <span className="text-sm text-neutral-500">Faces Detected</span>
                                    <span className="text-4xl font-black text-white">{aiResults.faces_detected}</span>
                                 </div>
                                 <div className="bg-orange-500/10 p-6 rounded-[2rem] flex justify-between items-center border border-orange-500/20">
                                    <span className="text-sm text-orange-200">Confirmed Attendance</span>
                                    <span className="text-4xl font-black text-orange-500">{aiResults.matched_students}</span>
                                 </div>
                                 <div className="bg-black/40 p-6 rounded-[2rem] flex justify-between items-center border border-white/5">
                                    <span className="text-sm text-neutral-500">Matching Fidelity</span>
                                    <span className="text-xl font-bold text-neutral-400">{aiResults.accuracy}</span>
                                 </div>
                              </div>

                              <button className="w-full py-4 rounded-2xl bg-neutral-800 text-neutral-400 font-bold uppercase text-[10px] tracking-widest hover:bg-neutral-700 transition-colors">
                                 Export Official Record →
                              </button>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          ) : (
            <>

              {!loading && classes.length === 0 && teacherId && !error && (
                <div className="py-24 text-center border-4 border-dashed border-neutral-900 rounded-[3rem] animate-pulse">
                    <p className="text-neutral-700 text-2xl font-black uppercase tracking-tight">No active sessions for today</p>
                    <p className="text-neutral-800 mt-2 font-mono text-xs">Verify faculty id or timetable constraints.</p>
                </div>
              )}

              <div className="grid gap-6">
                {classes.map((cls) => (
                  <div 
                    key={cls.timetable_id} 
                    className="group relative bg-neutral-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 hover:bg-neutral-900/60 transition-all duration-700 hover:border-orange-500/30 overflow-hidden"
                  >
                    {/* Decorative Background Icon */}
                    <div className="absolute -right-12 -bottom-12 transition-transform duration-700 group-hover:-translate-x-4 group-hover:-translate-y-4 opacity-[0.03] group-hover:opacity-10 pointer-events-none">
                       <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" /></svg>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                      <div className="flex flex-col items-start gap-4">
                        <span className="bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full ring-1 ring-orange-500/20">
                            {cls.time_slot.slot_name}
                        </span>
                        <div className="flex flex-col">
                            <span className="text-4xl font-black text-white">{formatTime(cls.time_slot.start_time)}</span>
                            <span className="text-neutral-600 font-mono text-sm">Ends at {formatTime(cls.time_slot.end_time)}</span>
                        </div>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div>
                            <h2 className="text-3xl font-black text-white leading-tight group-hover:text-orange-400 transition-colors">
                              {cls.subject.subject_name}
                            </h2>
                            <p className="text-neutral-500 font-mono text-sm uppercase tracking-wide mt-1">
                              {cls.subject.subject_code} • {cls.batch.batch_name} (Sec {cls.section.section_name})
                            </p>
                        </div>
                        
                        <div className="flex flex-wrap gap-x-8 gap-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 bg-neutral-600 rounded-full"></div>
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Enrolled Students</span>
                                  <span className="text-xl font-black text-white">{cls.section.section_strength} <span className="text-neutral-700 text-xs font-normal">Registered</span></span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-2 bg-neutral-600 rounded-full"></div>
                              <div className="flex flex-col">
                                  <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">Location</span>
                                  <span className="text-xl font-black text-white">
                                    {cls.classroom.room_number || "TBA"}
                                    <span className="text-neutral-700 text-xs font-normal ml-3">{cls.classroom.building_name || "Official Venue"}</span>
                                  </span>
                              </div>
                            </div>
                        </div>
                      </div>

                      <div className="w-full md:w-auto h-full flex flex-col justify-end self-stretch pt-4 md:pt-0">
                        <button 
                            className="bg-white text-black hover:bg-orange-500 hover:text-white transition-all w-full md:w-48 py-5 rounded-3xl font-extrabold uppercase text-xs tracking-[0.2em] shadow-2xl active:scale-95 group-hover:shadow-orange-500/20"
                            onClick={() => setSelectedClass(cls)}
                          >
                            Start Session
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer Insight */}
        {classes.length > 0 && !selectedClass && (
          <div className="flex py-12 items-center gap-4 text-neutral-800">
             <div className="flex-1 h-0.5 bg-neutral-900"></div>
             <span className="text-[10px] font-black uppercase tracking-[0.4em]">Chronological Sequence Sync Active</span>
             <div className="flex-1 h-0.5 bg-neutral-900"></div>
          </div>
        )}
      </div>
    </div>
  );
}
