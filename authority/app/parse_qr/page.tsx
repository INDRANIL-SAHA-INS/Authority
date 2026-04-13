"use client";

import { useState, useRef } from "react";
import jsQR from "jsqr";

export default function ParseQRPage() {
  const [userId, setUserId] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [qrData, setQrData] = useState<any>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "loading" | null; message: string }>({
    type: null,
    message: "",
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setImage(result);
        decodeQR(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const decodeQR = (imageSrc: string) => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        console.log(">>> Raw QR Data Scanned:", code.data);
        try {
          const parsed = JSON.parse(code.data);
          console.log(">>> Parsed QR JSON:", parsed);
          if (parsed.feature === "LIBRARY") {
            setQrData(parsed);
            setStatus({ type: "success", message: `QR Code scanned: ${parsed.action} ready.` });
          } else {
            console.error("!!! Invalid QR: Not a library entry/exit code.");
            setStatus({ type: "error", message: "Invalid QR: Not a library entry/exit code." });
          }
        } catch (err) {
          console.error("!!! JSON Parse Error for QR Content:", err);
          setStatus({ type: "error", message: "Invalid QR data format." });
        }
      } else {
        console.warn("!!! No QR code detected in image.");
        setStatus({ type: "error", message: "No QR code found in the image." });
      }
    };
    img.src = imageSrc;
  };

  const handleSubmit = async () => {
    if (!userId) {
      setStatus({ type: "error", message: "Please enter your User ID." });
      return;
    }
    if (!qrData) {
      setStatus({ type: "error", message: "Please upload a valid library QR code." });
      return;
    }

    const payload = {
      userId,
      action: qrData.action,
      secret: qrData.secret,
    };

    console.log(">>> Sending Log Request:", payload);

    try {
      const response = await fetch("/api/library/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        setStatus({
          type: "success",
          message: `${result.message}! (State: ${result.state})`,
        });
        // Reset form after success
        setUserId("");
        setImage(null);
        setQrData(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setStatus({ type: "error", message: result.error || "Failed to log visit." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "Network error. Please try again." });
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 font-[family-name:var(--font-geist-sans)]">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 blur-[120px] rounded-full" />
      </div>

      <main className="w-full max-w-xl z-10">
        <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent">
              Library Portal
            </h1>
            <p className="text-neutral-400">Manual Entry/Exit QR Processor</p>
          </div>

          <div className="space-y-6">
            {/* User ID Input */}
            <div className="space-y-2">
              <label htmlFor="userId" className="text-sm font-medium text-neutral-300">
                User ID
              </label>
              <input
                id="userId"
                type="text"
                placeholder="Enter unique User ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-neutral-800/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </div>

            {/* Upload Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">QR Code Image</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`group relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                  image ? 'border-blue-500/30 bg-blue-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                
                {image ? (
                  <div className="relative w-full aspect-square max-w-[200px] overflow-hidden rounded-xl">
                    <img src={image} alt="QR Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-xs font-medium">Change Image</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-neutral-200">Click to upload QR</p>
                      <p className="text-xs text-neutral-500 mt-1">PNG, JPG up to 10MB</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Hidden Canvas for Processing */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={status.type === "loading"}
              className="w-full bg-white text-black font-semibold py-4 rounded-xl hover:bg-neutral-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all flex items-center justify-center gap-2"
            >
              {status.type === "loading" ? (
                <>
                  <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                "Complete Log"
              )}
            </button>
          </div>

          {/* Status Message */}
          {status.type && (
            <div className={`p-4 rounded-xl border text-sm animate-in fade-in slide-in-from-top-2 duration-300 ${
              status.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 
              status.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  status.type === 'success' ? 'bg-emerald-400' : 
                  status.type === 'error' ? 'bg-red-400' : 'bg-blue-400 animate-pulse'
                }`} />
                {status.message}
              </div>
            </div>
          )}
        </div>

        {/* Instructions Footer */}
        <p className="text-center text-neutral-500 text-xs mt-8 px-4">
          Upload the entry/exit QR code generated by the system. <br/>
          Ensure your User ID is entered correctly before submitting.
        </p>
      </main>
    </div>
  );
}
