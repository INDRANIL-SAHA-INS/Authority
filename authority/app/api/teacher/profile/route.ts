import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

// Helper to safely serialize BigInt values in JSON
const safeJson = (data: unknown) =>
  JSON.stringify(data, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );

// Standardized CORS headers for development (especially for ngrok/cross-laptop testing)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, ngrok-skip-browser-warning",
};

/**
 * GET /api/teacher/profile
 * Fetches the profile data for the currently authenticated teacher.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Get the authenticated user and their teacher_id automatically
    const user = await getCurrentUser(req);

    // 2. Security Check: Ensure user is logged in and is a TEACHER
    if (!user || user.role !== "TEACHER") {
      return NextResponse.json(
        { success: false, message: "Unauthorized or not a teacher profile" },
        { status: 401, headers: corsHeaders }
      );
    }

    // 3. Use the specialized profileId (which is the teacher_id) from the token
    const teacherId = BigInt(user.profileId);

    // Fetch teacher data using the teacher_id
    const teacherData = await prisma.teacher.findUnique({
      where: { teacher_id: teacherId },
      include: {
        department: true,
        user: {
          select: {
            email: true,
            profile_image_url: true,
            is_active: true
          }
        }
      },
    });

    // Check if teacher exists
    if (!teacherData) {
      return NextResponse.json(
        { success: false, message: "Teacher profile not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    // Security Check: Ensure account is active
    if (teacherData.user && !teacherData.user.is_active) {
      return NextResponse.json(
        { success: false, message: "Account deactivated" },
        { status: 403, headers: corsHeaders }
      );
    }

    const { department, user: userData } = teacherData;

    // Construct the standardized profile response
    const profileData = {
      id: teacherData.employee_id || null,
      firstName: teacherData.first_name || null,
      lastName: teacherData.last_name || null,
      title: teacherData.qualification?.toLowerCase().includes("ph.d") ? "Dr." : "Prof.",
      profileImage: userData?.profile_image_url || null,
      designation: teacherData.designation || null,
      department: department?.department_name || null,
      collegeEmail: userData?.email || null,
      employeeId: teacherData.employee_id || null,
      
      // Location data derived from Department and Teacher room
      location: {
        block: department?.office_location?.split("-")[0]?.trim() || null,
        displayText: department?.office_location || "Not assigned"
      },
      cabin: {
        number: teacherData.office_room || null,
        displayText: teacherData.office_room ? `Cabin ${teacherData.office_room}` : "Not assigned"
      },

      // HARDCODED FALLBACKS as requested by the user
      officeHours: {
        schedule: [
          {
            days: "Mon-Fri",
            startTime: "09:00",
            endTime: "17:00",
            displayText: "Mon-Fri: 9:00 AM - 5:00 PM"
          }
        ],
        displayText: "Mon-Fri: 9:00 AM - 5:00 PM"
      },
      status: {
        isInOffice: true, // Hardcoded True
        isDarkThemeEnabled: true, // Hardcoded True
        currentStatus: teacherData.status || "ACTIVE"
      },
      college: "RV University" // Hardcoded
    };

    return new Response(safeJson({
      success: true,
      data: profileData
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("Error fetching teacher profile:", error);
    
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500, headers: corsHeaders }
    );
  }
}
