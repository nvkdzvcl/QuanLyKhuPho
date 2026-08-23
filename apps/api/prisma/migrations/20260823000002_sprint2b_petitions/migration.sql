-- AlterEnum
ALTER TYPE "notification_type_enum" ADD VALUE IF NOT EXISTS 'petition';

-- CreateEnum
CREATE TYPE "petition_category_enum" AS ENUM ('infrastructure', 'sanitation', 'security', 'other');

-- CreateEnum
CREATE TYPE "petition_status_enum" AS ENUM ('reviewing', 'processing', 'resolved', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "petitions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "category" "petition_category_enum" NOT NULL,
    "status" "petition_status_enum" NOT NULL DEFAULT 'reviewing',
    "neighborhood_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "response_note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petition_evidences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "petition_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petition_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "petition_histories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "petition_id" UUID NOT NULL,
    "from_status" "petition_status_enum",
    "to_status" "petition_status_enum" NOT NULL,
    "changed_by_id" UUID NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petition_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "petitions_status_created_at_idx" ON "petitions"("status", "created_at");

-- CreateIndex
CREATE INDEX "petitions_neighborhood_id_status_created_at_idx" ON "petitions"("neighborhood_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "petitions_author_id_status_created_at_idx" ON "petitions"("author_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "petitions_category_status_created_at_idx" ON "petitions"("category", "status", "created_at");

-- CreateIndex
CREATE INDEX "petition_evidences_petition_id_idx" ON "petition_evidences"("petition_id");

-- CreateIndex
CREATE INDEX "petition_histories_petition_id_created_at_idx" ON "petition_histories"("petition_id", "created_at");

-- CreateIndex
CREATE INDEX "petition_histories_changed_by_id_idx" ON "petition_histories"("changed_by_id");

-- Check Constraints
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_title_non_empty_check"
CHECK (char_length(trim("title")) > 0);

ALTER TABLE "petitions" ADD CONSTRAINT "petitions_description_non_empty_check"
CHECK (char_length(trim("description")) > 0);

ALTER TABLE "petitions" ADD CONSTRAINT "petitions_rejection_reason_check"
CHECK ("status" != 'rejected' OR ("response_note" IS NOT NULL AND char_length(trim("response_note")) > 0));

ALTER TABLE "petition_histories" ADD CONSTRAINT "petition_histories_valid_transition_check"
CHECK (
    ("from_status" IS NULL AND "to_status" = 'reviewing')
    OR
    ("from_status" = 'reviewing' AND "to_status" IN ('processing', 'cancelled'))
    OR
    ("from_status" = 'processing' AND "to_status" IN ('resolved', 'rejected'))
);

ALTER TABLE "petition_histories" ADD CONSTRAINT "petition_histories_rejection_note_check"
CHECK ("to_status" != 'rejected' OR ("note" IS NOT NULL AND char_length(trim("note")) > 0));

-- AddForeignKey
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petitions" ADD CONSTRAINT "petitions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_evidences" ADD CONSTRAINT "petition_evidences_petition_id_fkey" FOREIGN KEY ("petition_id") REFERENCES "petitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_histories" ADD CONSTRAINT "petition_histories_petition_id_fkey" FOREIGN KEY ("petition_id") REFERENCES "petitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_histories" ADD CONSTRAINT "petition_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutability Trigger: Prevent UPDATE or DELETE on petition_histories (append-only)
CREATE OR REPLACE FUNCTION prevent_petition_histories_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Updates and deletes are not allowed on petition_histories table';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER petition_histories_immutable_trigger
BEFORE UPDATE OR DELETE ON "petition_histories"
FOR EACH ROW
EXECUTE FUNCTION prevent_petition_histories_modification();
