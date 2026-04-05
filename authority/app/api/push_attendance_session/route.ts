import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";



// Helper function to get normalized current date at midnight
const getCurrentDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
};

export async function POST(request: NextRequest) {
    try {
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return new Response("Invalid JSON format", { status: 400 });
        }

        const { timetable_id } = body;
        if (!timetable_id) {
            return new Response("timetable_id is required", { status: 400 });
        }

        const session_date = getCurrentDate();
        
        // Use upsert or findFirst+create to ensure we don't create duplicates
        // and instead return the existing session if it was already started.
        let session = await prisma.attendanceSession.findUnique({
            where: {
                timetable_id_session_date: {
                    timetable_id: BigInt(timetable_id),
                    session_date: session_date,
                }
            }
        });

        if (!session) {
            const timetable = await prisma.timetable.findUnique({
                where: { timetable_id: BigInt(timetable_id) },
            });

            if (!timetable) {
                return new Response("Timetable entry not found", { status: 404 });
            }

            session = await prisma.attendanceSession.create({
                data: {
                    timetable_id: timetable.timetable_id,
                    teacher_id: timetable.teacher_id,
                    subject_id: timetable.subject_id,
                    batch_id: timetable.batch_id,
                    section_id: timetable.section_id,
                    classroom_id: timetable.classroom_id,
                    session_date: session_date,
                },
            });
        }

        const serializedSession = JSON.parse(JSON.stringify(session, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        return new Response(JSON.stringify(serializedSession), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error("Error creating attendance session:", error);
        return new Response("Failed to create/retrieve attendance session", { status: 500 });
    }
}
