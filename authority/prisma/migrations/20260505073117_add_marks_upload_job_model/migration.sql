-- CreateTable
CREATE TABLE "marks_upload_jobs" (
    "job_id" TEXT NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "exam_id" BIGINT,
    "file_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marks_upload_jobs_pkey" PRIMARY KEY ("job_id")
);

-- AddForeignKey
ALTER TABLE "marks_upload_jobs" ADD CONSTRAINT "marks_upload_jobs_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marks_upload_jobs" ADD CONSTRAINT "marks_upload_jobs_exam_id_fkey" FOREIGN KEY ("exam_id") REFERENCES "exams"("exam_id") ON DELETE SET NULL ON UPDATE CASCADE;
