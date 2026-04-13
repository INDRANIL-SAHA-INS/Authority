import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * API for Library Entry/Exit via QR Code
 * Expects: { userId: string, action: 'ENTRY' | 'EXIT', secret: string }
 * userId here is the unique ID from the central User table.
 * secret must match the LIBRARY_QR_SECRET env variable.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log(">>> Library API Request Body:", body);
    const { userId, action, secret } = body;

    // --- Security: Validate the QR secret key ---
    const validSecret = process.env.LIBRARY_QR_SECRET;
    console.log(">>> Configured Secret:", validSecret);
    console.log(">>> Received Secret from QR:", secret);

    if (!validSecret || secret !== validSecret) {
      console.warn("!!! Unauthorized: Secret mismatch.");
      return NextResponse.json(
        { error: "Unauthorized: Invalid QR source." },
        { status: 401 }
      );
    }

    if (!userId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = BigInt(userId);

    // ---------------------------------------------------------
    // HANDLE ENTRY
    // ---------------------------------------------------------
    if (action === "ENTRY") {
      try {
        const newLog = await prisma.libraryVisitLog.create({
          data: {
            user_id: id,
            library_entry_at: new Date(),
            library_session_state: "ACTIVE",
          },
        });

        return NextResponse.json({
          message: "Entry recorded successfully",
          logId: newLog.library_log_id.toString(),
          state: "ACTIVE",
        });
      } catch (err: any) {
        // Handle Unique Constraint Error (P2002) - Means user already has an ACTIVE session
        if (err.code === "P2002") {
          return NextResponse.json(
            { error: "Access Denied: You already have an active library session." },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    // ---------------------------------------------------------
    // HANDLE EXIT
    // ---------------------------------------------------------
    if (action === "EXIT") {
      // Find the active session for this specific user
      const activeSession = await prisma.libraryVisitLog.findFirst({
        where: {
          user_id: id,
          library_session_state: "ACTIVE",
        },
      });

      if (!activeSession) {
        return NextResponse.json(
          { error: "No active session found. Did you forget to scan Entry?" },
          { status: 404 }
        );
      }

      const updatedLog = await prisma.libraryVisitLog.update({
        where: { library_log_id: activeSession.library_log_id },
        data: {
          library_exit_at: new Date(),
          library_session_state: "CLOSED",
        },
      });

      return NextResponse.json({
        message: "Exit recorded successfully",
        logId: updatedLog.library_log_id.toString(),
        state: "CLOSED",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error: any) {
    console.error("Library API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}
