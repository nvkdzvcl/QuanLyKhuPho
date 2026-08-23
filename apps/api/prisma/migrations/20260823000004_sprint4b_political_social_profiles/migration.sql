-- CreateEnum
CREATE TYPE "party_status_enum" AS ENUM ('party_member', 'under_consideration', 'not_member');

-- CreateEnum
CREATE TYPE "highest_education_enum" AS ENUM ('lower_secondary', 'upper_secondary', 'vocational', 'college', 'bachelor', 'master', 'doctorate');

-- CreateTable
CREATE TABLE "political_social_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "resident_profile_id" UUID NOT NULL,
    "party_status" "party_status_enum" NOT NULL,
    "party_admission_date" TIMESTAMPTZ(6),
    "highest_education" "highest_education_enum",
    "specialty" VARCHAR(255),
    "official_occupation" VARCHAR(255),
    "strengths" VARCHAR(1000),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "political_social_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "political_social_profiles_resident_profile_id_key" ON "political_social_profiles"("resident_profile_id");

-- CreateIndex
CREATE INDEX "political_social_profiles_party_status_idx" ON "political_social_profiles"("party_status");

-- CreateIndex
CREATE INDEX "political_social_profiles_highest_education_idx" ON "political_social_profiles"("highest_education");

-- Keep party membership and admission date semantically consistent even when
-- writes do not originate from the application service.
ALTER TABLE "political_social_profiles" ADD CONSTRAINT "political_social_profiles_admission_date_check"
CHECK (
    ("party_status" = 'party_member' AND "party_admission_date" IS NOT NULL)
    OR
    ("party_status" <> 'party_member' AND "party_admission_date" IS NULL)
);

-- AddForeignKey
ALTER TABLE "political_social_profiles" ADD CONSTRAINT "political_social_profiles_resident_profile_id_fkey" FOREIGN KEY ("resident_profile_id") REFERENCES "resident_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
