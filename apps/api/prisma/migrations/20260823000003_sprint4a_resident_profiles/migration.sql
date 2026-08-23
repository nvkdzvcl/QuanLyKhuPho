-- CreateEnum
CREATE TYPE "gender_enum" AS ENUM ('male', 'female', 'other');

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "neighborhood_id" UUID NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resident_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(255) NOT NULL,
    "citizen_id_encrypted" TEXT NOT NULL,
    "citizen_id_hash" VARCHAR(64) NOT NULL,
    "citizen_id_issue_date" TIMESTAMPTZ(6),
    "birth_date" TIMESTAMPTZ(6) NOT NULL,
    "gender" "gender_enum" NOT NULL DEFAULT 'other',
    "place_of_birth" VARCHAR(255),
    "relationship_to_head" VARCHAR(100),
    "phone_encrypted" TEXT,
    "email_encrypted" TEXT,
    "occupation" VARCHAR(255),
    "permanent_address" VARCHAR(500) NOT NULL,
    "current_address" VARCHAR(500),
    "ward" VARCHAR(255),
    "city" VARCHAR(255),
    "household_id" UUID NOT NULL,
    "neighborhood_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resident_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "households_neighborhood_id_code_key" ON "households"("neighborhood_id", "code");

-- CreateIndex
CREATE INDEX "households_neighborhood_id_idx" ON "households"("neighborhood_id");

-- CreateIndex
CREATE UNIQUE INDEX "resident_profiles_citizen_id_hash_key" ON "resident_profiles"("citizen_id_hash");

-- CreateIndex
CREATE INDEX "resident_profiles_neighborhood_id_idx" ON "resident_profiles"("neighborhood_id");

-- CreateIndex
CREATE INDEX "resident_profiles_household_id_idx" ON "resident_profiles"("household_id");

-- CreateIndex
CREATE INDEX "resident_profiles_full_name_idx" ON "resident_profiles"("full_name");

-- CreateIndex
CREATE INDEX "resident_profiles_neighborhood_id_full_name_idx" ON "resident_profiles"("neighborhood_id", "full_name");

-- Check Constraints
ALTER TABLE "households" ADD CONSTRAINT "households_code_non_empty_check"
CHECK (char_length(trim("code")) > 0);

ALTER TABLE "households" ADD CONSTRAINT "households_address_non_empty_check"
CHECK (char_length(trim("address")) > 0);

ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_full_name_non_empty_check"
CHECK (char_length(trim("full_name")) > 0);

ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_permanent_address_non_empty_check"
CHECK (char_length(trim("permanent_address")) > 0);

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resident_profiles" ADD CONSTRAINT "resident_profiles_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
