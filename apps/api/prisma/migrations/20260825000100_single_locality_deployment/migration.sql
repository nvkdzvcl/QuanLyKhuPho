-- CreateEnum
CREATE TYPE "locality_level_enum" AS ENUM ('ward', 'commune', 'special_zone');

-- AlterTable
ALTER TABLE "neighborhoods" ALTER COLUMN "district" DROP NOT NULL;

-- CreateTable
CREATE TABLE "deployment_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "singleton_key" VARCHAR(50) NOT NULL DEFAULT 'SINGLETON',
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "slug" VARCHAR(100) NOT NULL,
    "locality_code" VARCHAR(50) NOT NULL,
    "locality_name" VARCHAR(255) NOT NULL,
    "locality_level" "locality_level_enum" NOT NULL DEFAULT 'ward',
    "province_code" VARCHAR(50) NOT NULL,
    "province_name" VARCHAR(255) NOT NULL,
    "district_name" VARCHAR(255),
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "locale" VARCHAR(20) NOT NULL DEFAULT 'vi-VN',
    "brand_name" VARCHAR(255) NOT NULL,
    "support_email" VARCHAR(255),
    "support_hotline" VARCHAR(50),
    "portal_url" VARCHAR(500),
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_at" TIMESTAMPTZ(6),
    "confirmed_by" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deployment_profiles_singleton_key_key" ON "deployment_profiles"("singleton_key");

-- CreateIndex
CREATE UNIQUE INDEX "deployment_profiles_slug_key" ON "deployment_profiles"("slug");

-- Singleton constraint ensuring only the single key is ever stored
ALTER TABLE "deployment_profiles" ADD CONSTRAINT "deployment_profiles_singleton_key_check"
CHECK ("singleton_key" = 'SINGLETON');

ALTER TABLE "deployment_profiles" ADD CONSTRAINT "deployment_profiles_schema_version_check"
CHECK ("schema_version" = 1);

ALTER TABLE "deployment_profiles" ADD CONSTRAINT "deployment_profiles_identity_non_empty_check"
CHECK (
    char_length(trim("slug")) > 0
    AND char_length(trim("locality_code")) > 0
    AND char_length(trim("locality_name")) > 0
    AND char_length(trim("province_code")) > 0
    AND char_length(trim("province_name")) > 0
    AND char_length(trim("brand_name")) > 0
);

ALTER TABLE "deployment_profiles" ADD CONSTRAINT "deployment_profiles_confirmation_check"
CHECK (
    ("confirmed" = false AND "confirmed_at" IS NULL)
    OR ("confirmed" = true AND "confirmed_at" IS NOT NULL)
);
