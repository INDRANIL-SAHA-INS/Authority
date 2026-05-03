import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Helper to safely serialize BigInt values in JSON
const safeJson = (data: unknown) =>
  JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

// Standardized CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

/**
 * GET /api/student/profile
 * Fetches the profile data for the currently authenticated student.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Get the authenticated user and their student_id automatically
    const user = await getCurrentUser(req);

    // 2. Security Check: Ensure user is logged in and is a STUDENT
    if (!user || user.role !== "STUDENT") {
      return NextResponse.json(
        { success: false, message: "Unauthorized or not a student profile" },
        { status: 401, headers: corsHeaders }
      );
    }

    // 3. Use the specialized profileId (which is the student_id) from the token
    const studentId = BigInt(user.profileId);

    // Fetch student data with all related academic info
    const studentData = await prisma.student.findUnique({
      where: { student_id: studentId },
      include: {
        batch: { select: { batch_name: true } },
        section: { select: { section_name: true } },
        program: { select: { program_name: true } },
        user: {
          select: {
            email: true,
            profile_image_url: true,
            is_active: true
          }
        }
      },
    });

    if (!studentData) {
      return NextResponse.json(
        { success: false, message: "Student record not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Security Check: Ensure account is active
    if (studentData.user && !studentData.user.is_active) {
      return NextResponse.json(
        { success: false, message: "Account deactivated" },
        { status: 403, headers: corsHeaders }
      );
    }

    // Construct standardized student profile response
    const profile = {
      id: studentData.student_id,
      fullName: `${studentData.first_name ?? ""} ${studentData.last_name ?? ""}`.trim(),
      universityRollNumber: studentData.university_roll_number,
      registrationNumber: studentData.registration_number,
      email: studentData.user?.email || null,
      profileImage: studentData.user?.profile_image_url || null,
      
      // Academic details
      academic: {
        program: studentData.program?.program_name || null,
        batch: studentData.batch?.batch_name || null,
        section: studentData.section?.section_name || null,
        status: studentData.student_status || "ACTIVE"
      },
      
      // Personal details
      personal: {
        gender: studentData.gender || null,
        dateOfBirth: studentData.date_of_birth ? studentData.date_of_birth.toISOString().split('T')[0] : null,
        bloodGroup: studentData.blood_group || null,
        phone: studentData.phone_number || null
      }
    };

    return new Response(safeJson({
      success: true,
      data: profile
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in student profile API:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
