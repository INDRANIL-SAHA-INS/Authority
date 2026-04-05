-- CreateTable
CREATE TABLE "library_visit_logs" (
    "library_log_id" BIGSERIAL NOT NULL,
    "library_user_ref" BIGINT NOT NULL,
    "library_entry_at" TIMESTAMP(3) NOT NULL,
    "library_exit_at" TIMESTAMP(3),
    "library_session_state" TEXT NOT NULL DEFAULT 'ACTIVE',
    "library_created_on" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "library_updated_on" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "library_visit_logs_pkey" PRIMARY KEY ("library_log_id")
);

-- CreateIndex
CREATE INDEX "library_visit_logs_library_user_ref_idx" ON "library_visit_logs"("library_user_ref");

-- CreateIndex
CREATE INDEX "library_visit_logs_library_session_state_idx" ON "library_visit_logs"("library_session_state");

-- CreateIndex
CREATE INDEX "library_visit_logs_library_user_ref_library_session_state_idx" ON "library_visit_logs"("library_user_ref", "library_session_state");

-- CreateIndex
CREATE INDEX "library_visit_logs_library_entry_at_idx" ON "library_visit_logs"("library_entry_at");

-- CreateIndex
CREATE UNIQUE INDEX "library_visit_logs_library_user_ref_library_session_state_key" ON "library_visit_logs"("library_user_ref", "library_session_state");

-- AddForeignKey
ALTER TABLE "library_visit_logs" ADD CONSTRAINT "library_visit_logs_library_user_ref_fkey" FOREIGN KEY ("library_user_ref") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;
