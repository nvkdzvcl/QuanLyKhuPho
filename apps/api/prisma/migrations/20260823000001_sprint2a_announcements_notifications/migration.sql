-- CreateEnum
CREATE TYPE "announcement_scope_enum" AS ENUM ('ward', 'neighborhood');

-- CreateEnum
CREATE TYPE "announcement_status_enum" AS ENUM ('published', 'removed');

-- CreateEnum
CREATE TYPE "notification_type_enum" AS ENUM ('announcement', 'comment', 'system');

-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "scope" "announcement_scope_enum" NOT NULL DEFAULT 'neighborhood',
    "status" "announcement_status_enum" NOT NULL DEFAULT 'published',
    "neighborhood_id" UUID,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "announcement_id" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "announcement_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" VARCHAR(1000) NOT NULL,
    "is_removed" BOOLEAN NOT NULL DEFAULT false,
    "removed_reason" TEXT,
    "removed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT NOT NULL,
    "type" "notification_type_enum" NOT NULL DEFAULT 'announcement',
    "reference_id" VARCHAR(255),
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "account_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_status_created_at_idx" ON "announcements"("status", "created_at");

-- CreateIndex
CREATE INDEX "announcements_neighborhood_id_status_created_at_idx" ON "announcements"("neighborhood_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "announcements_scope_status_created_at_idx" ON "announcements"("scope", "status", "created_at");

-- CreateIndex
CREATE INDEX "announcements_author_id_idx" ON "announcements"("author_id");

-- CreateIndex
CREATE INDEX "attachments_announcement_id_idx" ON "attachments"("announcement_id");

-- CreateIndex
CREATE INDEX "comments_announcement_id_created_at_idx" ON "comments"("announcement_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_author_id_idx" ON "comments"("author_id");

-- CreateIndex
CREATE INDEX "notifications_account_id_is_read_created_at_idx" ON "notifications"("account_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_account_id_created_at_idx" ON "notifications"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_account_id_idx" ON "push_subscriptions"("account_id");

-- Check Constraints
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_scope_neighborhood_check"
CHECK (("scope" = 'ward' AND "neighborhood_id" IS NULL) OR ("scope" = 'neighborhood' AND "neighborhood_id" IS NOT NULL));

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_title_non_empty_check"
CHECK (char_length(trim("title")) > 0);

ALTER TABLE "announcements" ADD CONSTRAINT "announcements_content_non_empty_check"
CHECK (char_length(trim("content")) > 0);

ALTER TABLE "comments" ADD CONSTRAINT "comments_content_non_empty_check"
CHECK (char_length(trim("content")) > 0);

ALTER TABLE "comments" ADD CONSTRAINT "comments_moderation_state_check"
CHECK (
    ("is_removed" = false AND "removed_reason" IS NULL AND "removed_by" IS NULL)
    OR
    ("is_removed" = true AND "removed_reason" IS NOT NULL AND "removed_by" IS NOT NULL)
);

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_removed_by_fkey" FOREIGN KEY ("removed_by") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
