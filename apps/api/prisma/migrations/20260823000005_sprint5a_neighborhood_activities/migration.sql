-- CreateEnum
CREATE TYPE "activity_filter_condition_enum" AS ENUM ('all', 'under_18', 'over_18', 'party_member', 'custom');

-- CreateEnum
CREATE TYPE "attendance_status_enum" AS ENUM ('attended', 'absent', 'unconfirmed');

-- CreateEnum
CREATE TYPE "activity_rating_enum" AS ENUM ('good', 'fair', 'average');

-- CreateTable
CREATE TABLE "neighborhood_activities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "neighborhood_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "activity_date" DATE NOT NULL,
    "description" TEXT,
    "person_in_charge" VARCHAR(255),
    "filter_condition" "activity_filter_condition_enum" NOT NULL DEFAULT 'all',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neighborhood_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "neighborhood_activity_participants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "activity_id" UUID NOT NULL,
    "resident_profile_id" UUID NOT NULL,
    "attendance" "attendance_status_enum" NOT NULL DEFAULT 'unconfirmed',
    "notes" VARCHAR(1000),
    "rating" "activity_rating_enum",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neighborhood_activity_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "neighborhood_activities_neighborhood_id_activity_date_idx" ON "neighborhood_activities"("neighborhood_id", "activity_date");

-- CreateIndex
CREATE INDEX "neighborhood_activities_activity_date_idx" ON "neighborhood_activities"("activity_date");

-- CreateIndex
CREATE INDEX "neighborhood_activities_created_by_id_idx" ON "neighborhood_activities"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "neighborhood_activity_participants_activity_id_resident_profile_id_key" ON "neighborhood_activity_participants"("activity_id", "resident_profile_id");

-- CreateIndex
CREATE INDEX "neighborhood_activity_participants_activity_id_idx" ON "neighborhood_activity_participants"("activity_id");

-- CreateIndex
CREATE INDEX "neighborhood_activity_participants_resident_profile_id_idx" ON "neighborhood_activity_participants"("resident_profile_id");

-- CreateIndex
CREATE INDEX "neighborhood_activity_participants_activity_id_attendance_idx" ON "neighborhood_activity_participants"("activity_id", "attendance");

-- Check Constraints
ALTER TABLE "neighborhood_activities" ADD CONSTRAINT "neighborhood_activities_name_non_empty_check"
CHECK (char_length(trim("name")) > 0);

-- AddForeignKey
ALTER TABLE "neighborhood_activities" ADD CONSTRAINT "neighborhood_activities_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhood_activities" ADD CONSTRAINT "neighborhood_activities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhood_activity_participants" ADD CONSTRAINT "neighborhood_activity_participants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "neighborhood_activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "neighborhood_activity_participants" ADD CONSTRAINT "neighborhood_activity_participants_resident_profile_id_fkey" FOREIGN KEY ("resident_profile_id") REFERENCES "resident_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
