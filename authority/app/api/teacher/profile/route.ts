import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/teacher/profile?user_id=...
 * Fetches the profile data for a specific teacher.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    
    // --- AUTHENTICATION / AUTHORIZATION ---
    // Currently using query parameter for development.
    // TODO: Replace with JWT/Session verification logic here.
    // Example: const payload = await verifyToken(req.headers.get("Authorization"));
    // const userIdFromToken = payload.sub;
    
    const userIdStr = searchParams.get("user_id");

    if (!userIdStr) {
      return NextResponse.json(
        { success: false, message: "user_id is required" },
        { status: 400 }
      );
    }

    // Convert string to BigInt for Prisma query
    const userId = BigInt(userIdStr);

    // Fetch user and teacher data with relations
    // Prisma uses indexes on @unique fields like user_id automatically for fast retrieval
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      include: {
        teacher: {
          include: {
            department: true,
          },
        },
      },
    });

    // 1. Check if user exists
    // 2. Enforce Teacher role only
    if (!user || user.role !== "TEACHER" || !user.teacher) {
      return NextResponse.json(
        { success: false, message: "Teacher profile not found or access denied" },
        { status: 403 }
      );
    }

    const { teacher } = user;
    const { department } = teacher;

    // Construct the standardized profile response
    const profileData = {
      id: teacher.employee_id || null,
      firstName: teacher.first_name || null,
      lastName: teacher.last_name || null,
      title: teacher.qualification?.toLowerCase().includes("ph.d") ? "Dr." : "Prof.",
      profileImage: user.profile_image_url || null,
      designation: teacher.designation || null,
      department: department?.department_name || null,
      collegeEmail: user.email,
      employeeId: teacher.employee_id || null,
      
      // Location data derived from Department and Teacher room
      location: {
        block: department?.office_location?.split("-")[0]?.trim() || null,
        displayText: department?.office_location || "Not assigned"
      },
      cabin: {
        number: teacher.office_room || null,
        displayText: teacher.office_room ? `Cabin ${teacher.office_room}` : "Not assigned"
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
        currentStatus: teacher.status || "ACTIVE"
      },
      college: "RV University" // Hardcoded
    };

    return NextResponse.json({
      success: true,
      data: profileData
    });

  } catch (error: any) {
    console.error("Error fetching teacher profile:", error);
    
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
