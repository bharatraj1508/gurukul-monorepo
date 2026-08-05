-- CreateTable
CREATE TABLE "diary" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "term_id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "course_id" UUID,
    "note" TEXT NOT NULL,
    "student_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "diary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "diary_tenant_id_class_id_idx" ON "diary"("tenant_id", "class_id");

-- CreateIndex
CREATE INDEX "diary_tenant_id_term_id_idx" ON "diary"("tenant_id", "term_id");

-- AddForeignKey
ALTER TABLE "diary" ADD CONSTRAINT "diary_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary" ADD CONSTRAINT "diary_term_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary" ADD CONSTRAINT "diary_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary" ADD CONSTRAINT "diary_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary" ADD CONSTRAINT "diary_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary" ADD CONSTRAINT "diary_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diary" ADD CONSTRAINT "diary_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
