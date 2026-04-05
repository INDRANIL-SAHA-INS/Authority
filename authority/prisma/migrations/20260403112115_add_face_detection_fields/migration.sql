-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "captured_face_url" TEXT;

-- AlterTable
ALTER TABLE "attendance_sessions" ADD COLUMN     "class_photo_url" TEXT;

-- AlterTable
ALTER TABLE "face_data" ADD COLUMN     "is_primary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "model_name" TEXT;
