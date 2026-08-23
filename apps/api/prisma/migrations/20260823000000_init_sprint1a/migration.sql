-- CreateEnum
CREATE TYPE "role_enum" AS ENUM ('resident', 'leader', 'officer');

-- CreateEnum
CREATE TYPE "account_status_enum" AS ENUM ('pending', 'active', 'locked', 'rejected');

-- CreateTable
CREATE TABLE "neighborhoods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "ward" VARCHAR(255) NOT NULL,
    "district" VARCHAR(255) NOT NULL,
    "city" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "neighborhoods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone_encrypted" TEXT NOT NULL,
    "phone_hash" VARCHAR(64) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" "role_enum" NOT NULL DEFAULT 'resident',
    "status" "account_status_enum" NOT NULL DEFAULT 'pending',
    "address" VARCHAR(500),
    "rejection_reason" TEXT,
    "lock_reason" TEXT,
    "neighborhood_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "neighborhoods_code_key" ON "neighborhoods"("code");

-- A neighborhood name is unique inside a ward.
CREATE UNIQUE INDEX "neighborhoods_ward_name_key" ON "neighborhoods"("ward", "name");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_phone_hash_key" ON "accounts"("phone_hash");

-- CreateIndex
CREATE INDEX "accounts_role_status_idx" ON "accounts"("role", "status");

-- CreateIndex
CREATE INDEX "accounts_neighborhood_id_status_idx" ON "accounts"("neighborhood_id", "status");

-- CreateIndex
CREATE INDEX "accounts_neighborhood_id_role_idx" ON "accounts"("neighborhood_id", "role");

-- Only one active leader can be assigned to a neighborhood at a time.
CREATE UNIQUE INDEX "accounts_one_active_leader_per_neighborhood"
ON "accounts"("neighborhood_id")
WHERE "role" = 'leader' AND "status" = 'active';

-- Domain invariants that Prisma cannot express as field nullability alone.
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_role_neighborhood_check"
CHECK ("role" = 'officer' OR "neighborhood_id" IS NOT NULL);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_resident_address_check"
CHECK ("role" <> 'resident' OR "address" IS NOT NULL);

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_rejection_reason_check"
CHECK (("status" = 'rejected' AND "rejection_reason" IS NOT NULL) OR ("status" <> 'rejected' AND "rejection_reason" IS NULL));

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_lock_reason_check"
CHECK (("status" = 'locked' AND "lock_reason" IS NOT NULL) OR ("status" <> 'locked' AND "lock_reason" IS NULL));

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
