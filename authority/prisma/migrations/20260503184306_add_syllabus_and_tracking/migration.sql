-- CreateTable
CREATE TABLE "syllabus_modules" (
    "module_id" BIGSERIAL NOT NULL,
    "subject_id" BIGINT NOT NULL,
    "module_number" INTEGER NOT NULL,
    "module_name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_modules_pkey" PRIMARY KEY ("module_id")
);

-- CreateTable
CREATE TABLE "syllabus_topics" (
    "topic_id" BIGSERIAL NOT NULL,
    "module_id" BIGINT NOT NULL,
    "topic_number" INTEGER NOT NULL,
    "topic_name" TEXT NOT NULL,
    "description" TEXT,
    "content_ai" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_topics_pkey" PRIMARY KEY ("topic_id")
);

-- CreateTable
CREATE TABLE "syllabus_resources" (
    "resource_id" BIGSERIAL NOT NULL,
    "module_id" BIGINT,
    "topic_id" BIGINT,
    "resource_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "content_text" TEXT,
    "resource_order" INTEGER NOT NULL DEFAULT 0,
    "is_ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_resources_pkey" PRIMARY KEY ("resource_id")
);

-- CreateTable
CREATE TABLE "topic_coverage" (
    "coverage_id" BIGSERIAL NOT NULL,
    "topic_id" BIGINT NOT NULL,
    "session_id" BIGINT NOT NULL,
    "teacher_id" BIGINT NOT NULL,
    "batch_id" BIGINT NOT NULL,
    "section_id" BIGINT NOT NULL,
    "period_id" BIGINT NOT NULL,
    "covered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,

    CONSTRAINT "topic_coverage_pkey" PRIMARY KEY ("coverage_id")
);

-- CreateTable
CREATE TABLE "module_questions" (
    "question_id" BIGSERIAL NOT NULL,
    "module_id" BIGINT NOT NULL,
    "question_text" TEXT NOT NULL,
    "options" JSONB,
    "correct_answer" TEXT NOT NULL,
    "explanation" TEXT,
    "difficulty" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "module_questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "module_practice_results" (
    "result_id" BIGSERIAL NOT NULL,
    "student_id" BIGINT NOT NULL,
    "module_id" BIGINT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "total_questions" INTEGER NOT NULL,
    "responses" JSONB,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "module_practice_results_pkey" PRIMARY KEY ("result_id")
);

-- CreateIndex
CREATE INDEX "syllabus_modules_subject_id_idx" ON "syllabus_modules"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_modules_subject_id_module_number_key" ON "syllabus_modules"("subject_id", "module_number");

-- CreateIndex
CREATE INDEX "syllabus_topics_module_id_idx" ON "syllabus_topics"("module_id");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_topics_module_id_topic_number_key" ON "syllabus_topics"("module_id", "topic_number");

-- CreateIndex
CREATE INDEX "syllabus_resources_module_id_idx" ON "syllabus_resources"("module_id");

-- CreateIndex
CREATE INDEX "syllabus_resources_topic_id_idx" ON "syllabus_resources"("topic_id");

-- CreateIndex
CREATE INDEX "topic_coverage_section_id_period_id_idx" ON "topic_coverage"("section_id", "period_id");

-- CreateIndex
CREATE INDEX "topic_coverage_topic_id_idx" ON "topic_coverage"("topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_coverage_topic_id_section_id_period_id_key" ON "topic_coverage"("topic_id", "section_id", "period_id");

-- CreateIndex
CREATE INDEX "module_questions_module_id_idx" ON "module_questions"("module_id");

-- CreateIndex
CREATE INDEX "module_practice_results_student_id_idx" ON "module_practice_results"("student_id");

-- CreateIndex
CREATE INDEX "module_practice_results_module_id_idx" ON "module_practice_results"("module_id");

-- AddForeignKey
ALTER TABLE "syllabus_modules" ADD CONSTRAINT "syllabus_modules_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("subject_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_topics" ADD CONSTRAINT "syllabus_topics_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "syllabus_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_resources" ADD CONSTRAINT "syllabus_resources_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "syllabus_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_resources" ADD CONSTRAINT "syllabus_resources_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "syllabus_topics"("topic_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "syllabus_topics"("topic_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "attendance_sessions"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "teachers"("teacher_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("batch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("section_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_coverage" ADD CONSTRAINT "topic_coverage_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "academic_periods"("period_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_questions" ADD CONSTRAINT "module_questions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "syllabus_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_practice_results" ADD CONSTRAINT "module_practice_results_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "module_practice_results" ADD CONSTRAINT "module_practice_results_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "syllabus_modules"("module_id") ON DELETE CASCADE ON UPDATE CASCADE;
