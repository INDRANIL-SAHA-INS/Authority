import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const teacher_id = searchParams.get("teacher_id");

        if (!teacher_id) {
            return new Response(JSON.stringify({ error: "teacher_id is required in query parameters" }), {
                status: 400,
                headers: {
                    "Content-Type": "application/json",
                },
            });
        }

        const teacher_sub = await prisma.teacherSubjectAssignment.findMany({
            where: {
                teacher_id: BigInt(teacher_id),
                assignment_status: "ACTIVE",
            },
            include: {
                subject: true,
                batch: true,
                section: {
                    include: {
                        students: true,
                    },
                },
                period: true,
            }
        });

        const safeStringify = (obj: unknown) => JSON.stringify(obj, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        );

        return new Response(safeStringify(teacher_sub), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        console.error("Error fetching teacher subjects:", error);
        return new Response(JSON.stringify({ error: "Failed to fetch teacher subjects" }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
            },
        });
    }
}
