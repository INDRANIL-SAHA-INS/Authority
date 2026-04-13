"use client";

import React, { useState } from "react";

export default function MockJobForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch("/api/job_submit", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Submission successful:", result);
        setSubmitted(true);
      } else {
        console.error("Submission failed:", await response.text());
        alert("Submission failed. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("An error occurred. Check the console for details.");
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center p-12 rounded-2xl border border-[var(--foreground)] opacity-90">
          <h2 className="text-4xl font-black mb-4 tracking-tighter">SUCCESS</h2>
          <p className="text-lg opacity-70 mb-8">Application submitted successfully.</p>
          <button 
            onClick={() => setSubmitted(false)}
            className="w-full py-4 bg-[var(--foreground)] text-[var(--background)] font-bold rounded-lg hover:opacity-80 transition"
          >
            GO BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 md:p-24 font-sans">
      <div className="max-w-4xl mx-auto space-y-16">
        
        {/* Job Header */}
        <header className="space-y-6">
          <div className="inline-block px-3 py-1 border border-[var(--foreground)] text-[10px] font-bold uppercase tracking-widest">
            Open Position
          </div>
          <h1 id="job-title" className="text-5xl md:text-7xl font-black tracking-tighter uppercase leading-[0.9]">
            Senior Automation <br/> Engineer
          </h1>
          <div id="job-description" className="max-w-2xl text-lg leading-relaxed border-l-2 border-[var(--foreground)] pl-8 py-4 opacity-80">
            <p className="mb-4">
              We are seeking a lead engineer to build the core browser automation engine for our AI agents. 
              You will work with Python, Playwright, and LangGraph to create resilient web interaction layers.
            </p>
            <p className="text-sm font-mono">
              [REQUIREMENTS]: Python 3.10+, LLM Prompt Engineering, Playwright Expert.
            </p>
          </div>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-20 border-t border-[var(--foreground)] pt-16">
          
          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-xl font-bold uppercase tracking-tight">01 Personal</div>
            <div className="md:col-span-2 grid grid-cols-1 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Full Name</label>
                <input required name="full_name" type="text" className="w-full bg-transparent border-2 border-zinc-400 p-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors text-xl font-medium" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Email Address</label>
                <input required name="email" type="email" className="w-full bg-transparent border-2 border-zinc-400 p-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors text-xl font-medium" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Phone</label>
                  <input required name="phone" type="tel" className="w-full bg-transparent border-2 border-zinc-400 p-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors text-xl font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Location</label>
                  <input name="location" type="text" className="w-full bg-transparent border-2 border-zinc-400 p-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors text-xl font-medium" />
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-xl font-bold uppercase tracking-tight">02 Social</div>
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-60">LinkedIn</label>
                <input name="linkedin" type="url" className="w-full bg-transparent border-2 border-zinc-400 p-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors text-lg" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-60">GitHub</label>
                <input name="github" type="url" className="w-full bg-transparent border-2 border-zinc-400 p-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors text-lg" />
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-xl font-bold uppercase tracking-tight">03 Assessment</div>
            <div className="md:col-span-2 space-y-12">
              <div className="space-y-4">
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Years of Experience</label>
                <select name="years_of_experience" className="w-full bg-transparent border-2 border-zinc-400 p-4 rounded-xl focus:outline-none text-xl font-medium cursor-pointer">
                  <option value="" className="bg-[var(--background)]">SELECT EXPERIENCE</option>
                  <option value="0-1" className="bg-[var(--background)]">0 - 1 YEARS</option>
                  <option value="1-3" className="bg-[var(--background)]">1 - 3 YEARS</option>
                  <option value="3-5" className="bg-[var(--background)]">3 - 5 YEARS</option>
                  <option value="5+" className="bg-[var(--background)]">5+ YEARS</option>
                </select>
              </div>
              <div className="space-y-4">
                <label className="text-[10px] uppercase font-bold tracking-widest opacity-60">Complex Project Description</label>
                <textarea name="complex_project" rows={4} className="w-full bg-transparent border-2 border-zinc-400 p-4 rounded-xl focus:outline-none focus:border-indigo-500 transition-colors text-lg font-medium" placeholder="TYPE YOUR RESPONSE..."></textarea>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-xl font-bold uppercase tracking-tight">04 Assets</div>
            <div className="md:col-span-2">
              <div className="border-4 border-dashed border-[var(--foreground)] p-12 text-center hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all cursor-pointer relative group">
                <input type="file" name="resume" className="absolute inset-0 opacity-0 cursor-pointer" id="resume-upload" />
                <span className="text-2xl font-black uppercase tracking-tighter">CLICK OR DRAG RESUME HERE</span>
              </div>
            </div>
          </section>

          <footer className="pt-12 flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="flex items-center space-x-4">
              <input type="checkbox" id="terms" required className="w-6 h-6 border-2 border-[var(--foreground)] bg-transparent checked:bg-[var(--foreground)]" />
              <label htmlFor="terms" className="text-xs font-bold uppercase tracking-widest">I confirm these details are accurate</label>
            </div>
            <button 
              type="submit" 
              id="submit-application"
              className="px-16 py-6 bg-[var(--foreground)] text-[var(--background)] font-black text-2xl uppercase tracking-tighter hover:opacity-80 transition"
            >
              Submit Application
            </button>
          </footer>

        </form>
      </div>
    </div>
  );
}
