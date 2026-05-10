import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// TOGGLE THIS TO TRUE TO STOP DATABASE UPDATES AND ONLY LOG THE RESPONSE
const DEVELOPMENT_PHASE_ON = true;

/**
 * MARKS UPLOAD CALLBACK (WEBHOOK)
 * -------------------------------
 * This endpoint is called by the Python Microservice once data extraction
 * and AI mapping are complete. It handles the final database persistence.
 */
export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get("sectionId");
    const subjectId = searchParams.get("subjectId");
    const examType = searchParams.get("examType");
    const periodId = searchParams.get("periodId");

    const payload = await req.json();
    const { job_id, success, data, error } = payload;

    if (DEVELOPMENT_PHASE_ON) {
      console.log("--------------------------------------------------");
      console.log("[DEV MODE] RECEIVED PYTHON CALLBACK");
      console.log(`JOB ID: ${job_id}`);
      console.log(`SUCCESS: ${success}`);
      if (success) {
        console.log("FULL EXTRACTED DATA:");
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.error(`ERROR RECEIVED: ${error}`);
      }
      console.log("--------------------------------------------------");
      
      // Still update the job status so the UI knows it's "Done" (mocked)
      await prisma.marksUploadJob.update({
        where: { job_id },
        data: { status: success ? "COMPLETED" : "FAILED", error_message: error }
      });

      return NextResponse.json({ success: true, status: "dev_mode_logged" });
    }

    // Handle extraction failure
    if (!success) {
      console.error(`[MarksCallback] Extraction failed for job ${job_id}: ${error}`);
      await prisma.marksUploadJob.update({
        where: { job_id },
        data: { status: "FAILED", error_message: error || "Unknown error during extraction" }
      });
      return NextResponse.json({ success: true, status: "error_logged" });
    }

    // 1. Resolve Batch from Section
    const section = await prisma.section.findUnique({
      where: { section_id: BigInt(sectionId!) },
      select: { batch_id: true }
    });

    if (!section) {
      throw new Error(`Section ID ${sectionId} not found in database.`);
    }

    // 2. Database Transaction for Data Integrity
    await prisma.$transaction(async (tx) => {
      
      // A. Upsert the Exam record
      const exam = await tx.exam.upsert({
        where: {
          subject_id_batch_id_period_id_exam_type: {
            subject_id: BigInt(subjectId!),
            batch_id: section.batch_id,
            period_id: BigInt(periodId!),
            exam_type: examType!,
          }
        },
        update: { 
          components: data.metadata.canonical_components,
          updated_at: new Date()
        },
        create: {
          subject_id: BigInt(subjectId!),
          batch_id: section.batch_id,
          period_id: BigInt(periodId!),
          exam_type: examType!,
          total_marks: 100,  // Defaults, can be updated via UI later
          passing_marks: 40,
          components: data.metadata.canonical_components,
          status: "OPEN"
        }
      });

      // B. Process Student Results
      // We use section_id to scope the student search for maximum efficiency
      for (const record of data.records) {
        const student = await tx.student.findFirst({
          where: { 
            university_roll_number: record.university_roll_number,
            section_id: BigInt(sectionId!) 
          },
          select: { student_id: true }
        });

        // If student not found in this section, skip (prevents wrong section uploads)
        if (!student) continue;

        await tx.examResult.upsert({
          where: { 
            exam_id_student_id: { 
              exam_id: exam.exam_id, 
              student_id: student.student_id 
            } 
          },
          update: {
            marks_obtained: record.marks_obtained,
            is_absent: record.is_absent,
            sub_marks: record.sub_marks,
            updated_at: new Date()
          },
          create: {
            exam_id: exam.exam_id,
            student_id: student.student_id,
            marks_obtained: record.marks_obtained,
            is_absent: record.is_absent,
            sub_marks: record.sub_marks
          }
        });
      }

      // C. Update Job Status to COMPLETED
      await tx.marksUploadJob.update({
        where: { job_id },
        data: { 
          status: "COMPLETED", 
          exam_id: exam.exam_id 
        }
      });
    });

    console.log(`[MarksCallback] Successfully processed job ${job_id}`);
    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[MarksCallback Error]:", err);
    return NextResponse.json({ success: false, message: "Internal callback error" }, { status: 500 });
  }
}
