import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";






export async function GET(request: NextRequest) {
  try {
    const teacherId = request.nextUrl.searchParams.get("teacher_id");
    if (!teacherId) {
      return new Response("Teacher ID is required", { status: 400 });
    }
    const timetable = await prisma.timetable.findMany({
      where: {
        teacher_id: BigInt(teacherId),
      },
      include:{
          subject: true,
          batch: true,
          section: true,
          classroom: true,
          time_slot: true,
          period: true
      }
    });

    const safeStringify = (obj: unknown) => JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );


    return new Response(safeStringify(timetable), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error fetching teacher timetable:", error);
    return new Response("Failed to fetch teacher timetable", { status: 500 });
  }               
}
