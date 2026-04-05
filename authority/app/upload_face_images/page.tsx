"use client";

import { useState } from "react";

export default function StudentEnrollmentPage() {
  const [studentId, setStudentId] = useState("");
  const [images, setImages] = useState<{ [key: string]: string }>({
    front: "",
    left: "",
    right: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, angle: string) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages((prev) => ({ ...prev, [angle]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });
    const normalizedStudentId = studentId.trim();

    // Validate
    if (!normalizedStudentId || !images.front || !images.left || !images.right) {
      setMessage({ type: "error", text: "Please provide Student ID and all 3 face angles." });
      setLoading(false);
      return;
    }

    if (!/^\d+$/.test(normalizedStudentId)) {
      setMessage({ type: "error", text: "Student ID must contain digits only." });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        student_id: normalizedStudentId,
        face_samples: [
          { angle: "front", image_b64: images.front },
          { angle: "left", image_b64: images.left },
          { angle: "right", image_b64: images.right },
        ],
      };

      const response = await fetch("/api/student_face_enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") ?? "";
      let data: { message?: string; error?: string } = {};

      if (contentType.includes("application/json")) {
        try {
          data = (await response.json()) as { message?: string; error?: string };
        } catch {
          data = { error: "Server returned invalid JSON." };
        }
      } else {
        const textResponse = await response.text();
        data = { error: textResponse || "Server returned a non-JSON response." };
      }

      if (response.ok) {
        setMessage({ type: "success", text: `Enrollment successful! ${data.message ?? ""}`.trim() });
        setStudentId("");
        setImages({ front: "", left: "", right: "" });
      } else {
        setMessage({ type: "error", text: data.error || data.message || `Enrollment failed (HTTP ${response.status}).` });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Student Face Enrollment</h1>
        <p className="text-gray-500 mb-8">Register student face vectors for the attendance system.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Student ID */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Student ID (Numeric)</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. 2024001"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
              required
            />
          </div>

          {/* Image Uploads */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {["front", "left", "right"].map((angle) => (
              <div key={angle} className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  {angle} View
                </label>
                <div className="relative group">
                  <div className={`aspect-square rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${images[angle] ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50 group-hover:border-blue-400"}`}>
                    {images[angle] ? (
                      <img src={images[angle]} alt={angle} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-gray-400 text-sm">No Image</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, angle)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Status Message */}
          {message.text && (
            <div className={`p-4 rounded-xl text-sm font-medium ${message.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {message.text}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:transform active:scale-95"}`}
          >
            {loading ? "Processing AI Vectors..." : "Save Enrollment"}
          </button>
        </form>
      </div>
      
      <footer className="mt-8 text-gray-400 text-sm italic">
        Ensure Python Microservice is running at http://localhost:8000
      </footer>
    </div>
  );
}
