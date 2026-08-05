-- CreateTable
CREATE TABLE "rooms" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'CLASSROOM',
    "capacity" INTEGER NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_templates" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "working_days" INTEGER[],
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "period_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_template_slots" (
    "id" UUID NOT NULL,
    "period_template_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "label" VARCHAR(100),
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "period_number" INTEGER,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_template_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetables" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "academic_term_id" UUID NOT NULL,
    "period_template_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'GENERATING',
    "job_id" VARCHAR(100),
    "input_snapshot" JSONB,
    "violations" JSONB,
    "failure_hints" JSONB,
    "solver_stats" JSONB,
    "published_at" TIMESTAMP(6),
    "published_by" UUID,
    "archived_at" TIMESTAMP(6),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "timetables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "timetable_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "period_number" INTEGER NOT NULL,
    "course_id" UUID NOT NULL,
    "teacher_membership_id" UUID,
    "room_id" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_substitutions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "timetable_slot_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "substitute_teacher_membership_id" UUID NOT NULL,
    "reason" VARCHAR(255),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "timetable_substitutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_constraints" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tenant_membership_id" UUID NOT NULL,
    "max_periods_per_day" INTEGER,
    "max_periods_per_week" INTEGER,
    "max_consecutive_periods" INTEGER,
    "availability" JSONB,
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "teacher_constraints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_allocations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "class_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "periods_per_week" INTEGER NOT NULL,
    "consecutive_block_size" INTEGER NOT NULL DEFAULT 1,
    "room_id" UUID,
    "room_type" VARCHAR(50),
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "course_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rooms_tenant_id_name_key" ON "rooms"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "period_templates_tenant_id_name_key" ON "period_templates"("tenant_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "period_template_slots_period_template_id_sort_order_key" ON "period_template_slots"("period_template_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "period_template_slots_period_template_id_period_number_key" ON "period_template_slots"("period_template_id", "period_number");

-- CreateIndex
CREATE INDEX "timetables_tenant_id_academic_term_id_status_idx" ON "timetables"("tenant_id", "academic_term_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "timetables_tenant_id_academic_term_id_version_key" ON "timetables"("tenant_id", "academic_term_id", "version");

-- CreateIndex
CREATE INDEX "timetable_slots_tenant_id_timetable_id_teacher_membership_i_idx" ON "timetable_slots"("tenant_id", "timetable_id", "teacher_membership_id");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_timetable_id_class_id_day_of_week_period_nu_key" ON "timetable_slots"("timetable_id", "class_id", "day_of_week", "period_number");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_timetable_id_teacher_membership_id_day_of_w_key" ON "timetable_slots"("timetable_id", "teacher_membership_id", "day_of_week", "period_number");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_slots_timetable_id_room_id_day_of_week_period_num_key" ON "timetable_slots"("timetable_id", "room_id", "day_of_week", "period_number");

-- CreateIndex
CREATE INDEX "timetable_substitutions_tenant_id_date_idx" ON "timetable_substitutions"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "timetable_substitutions_timetable_slot_id_date_key" ON "timetable_substitutions"("timetable_slot_id", "date");

-- CreateIndex
CREATE INDEX "teacher_constraints_tenant_id_idx" ON "teacher_constraints"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_constraints_tenant_membership_id_key" ON "teacher_constraints"("tenant_membership_id");

-- CreateIndex
CREATE INDEX "course_allocations_tenant_id_class_id_idx" ON "course_allocations"("tenant_id", "class_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_allocations_class_id_course_id_key" ON "course_allocations"("class_id", "course_id");

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_templates" ADD CONSTRAINT "period_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_templates" ADD CONSTRAINT "period_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_templates" ADD CONSTRAINT "period_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_template_slots" ADD CONSTRAINT "period_template_slots_period_template_id_fkey" FOREIGN KEY ("period_template_id") REFERENCES "period_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_academic_term_id_fkey" FOREIGN KEY ("academic_term_id") REFERENCES "academic_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_period_template_id_fkey" FOREIGN KEY ("period_template_id") REFERENCES "period_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetables" ADD CONSTRAINT "timetables_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_timetable_id_fkey" FOREIGN KEY ("timetable_id") REFERENCES "timetables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacher_membership_id_fkey" FOREIGN KEY ("teacher_membership_id") REFERENCES "tenant_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_timetable_slot_id_fkey" FOREIGN KEY ("timetable_slot_id") REFERENCES "timetable_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_substitute_teacher_membership_id_fkey" FOREIGN KEY ("substitute_teacher_membership_id") REFERENCES "tenant_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_substitutions" ADD CONSTRAINT "timetable_substitutions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_constraints" ADD CONSTRAINT "teacher_constraints_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_constraints" ADD CONSTRAINT "teacher_constraints_tenant_membership_id_fkey" FOREIGN KEY ("tenant_membership_id") REFERENCES "tenant_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_constraints" ADD CONSTRAINT "teacher_constraints_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_constraints" ADD CONSTRAINT "teacher_constraints_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_allocations" ADD CONSTRAINT "course_allocations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
