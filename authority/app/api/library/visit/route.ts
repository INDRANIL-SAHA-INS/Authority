import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Standardized CORS headers for Mobile/Web compatibility
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

// Helper for BigInt serialization
const safeJson = (obj: any) => JSON.stringify(obj, (_, v) => typeof v === "bigint" ? v.toString() : v);

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * API for Library Entry/Exit via QR Code
 * Expects: { action: 'ENTRY' | 'EXIT', secret: string }
 * Security: Validates the JWT token for identity and the QR secret for physical presence.
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Identity Check
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { action, secret } = body;
    const userId = BigInt(user.id); // Derived from secure JWT token

    // 2. Secret Validation (Ensures user is at the physical QR code)
    const validSecret = process.env.LIBRARY_QR_SECRET;
    if (!validSecret || secret !== validSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid QR source." },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!action) {
      return NextResponse.json({ success: false, error: "Missing action field" }, { status: 400, headers: corsHeaders });
    }

    // ---------------------------------------------------------
    // HANDLE ENTRY
    // ---------------------------------------------------------
    if (action === "ENTRY") {
      // 1. Check if the user already has an active session
      const existingSession = await prisma.libraryVisitLog.findFirst({
        where: { user_id: userId, library_session_state: "ACTIVE" }
      });

      if (existingSession) {
        return NextResponse.json(
          { success: false, error: "Access Denied: You already have an active library session." },
          { status: 409, headers: corsHeaders }
        );
      }

      // 2. Create the new session
      const newLog = await prisma.libraryVisitLog.create({
        data: {
          user_id: userId,
          library_entry_at: new Date(),
          library_session_state: "ACTIVE",
        },
      });

      return new Response(safeJson({
        success: true,
        message: "Library entry recorded",
        logId: newLog.library_log_id,
        state: "ACTIVE",
      }), { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ---------------------------------------------------------
    // HANDLE EXIT
    // ---------------------------------------------------------
    if (action === "EXIT") {
      const activeSession = await prisma.libraryVisitLog.findFirst({
        where: {
          user_id: userId,
          library_session_state: "ACTIVE",
        },
      });

      if (!activeSession) {
        return NextResponse.json(
          { success: false, error: "No active session found. Did you forget to scan Entry?" },
          { status: 404, headers: corsHeaders }
        );
      }

      const updatedLog = await prisma.libraryVisitLog.update({
        where: { library_log_id: activeSession.library_log_id },
        data: {
          library_exit_at: new Date(),
          library_session_state: "CLOSED",
        },
      });

      return new Response(safeJson({
        success: true,
        message: "Library exit recorded",
        logId: updatedLog.library_log_id,
        state: "CLOSED",
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400, headers: corsHeaders });

  } catch (error: any) {
    console.error("Library API Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error", details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
