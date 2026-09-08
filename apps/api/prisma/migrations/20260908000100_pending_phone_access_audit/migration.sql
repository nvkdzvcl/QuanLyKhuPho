-- CreateTable
CREATE TABLE "account_phone_access_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_account_id" UUID NOT NULL,
    "target_account_id" UUID NOT NULL,
    "neighborhood_id" UUID,
    "actor_role" "role_enum" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_phone_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_phone_access_logs_actor_account_id_created_at_idx" ON "account_phone_access_logs"("actor_account_id", "created_at");

-- CreateIndex
CREATE INDEX "account_phone_access_logs_target_account_id_created_at_idx" ON "account_phone_access_logs"("target_account_id", "created_at");

-- CreateIndex
CREATE INDEX "account_phone_access_logs_neighborhood_id_created_at_idx" ON "account_phone_access_logs"("neighborhood_id", "created_at");

-- AddForeignKey
ALTER TABLE "account_phone_access_logs" ADD CONSTRAINT "account_phone_access_logs_actor_account_id_fkey" FOREIGN KEY ("actor_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_phone_access_logs" ADD CONSTRAINT "account_phone_access_logs_target_account_id_fkey" FOREIGN KEY ("target_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_phone_access_logs" ADD CONSTRAINT "account_phone_access_logs_neighborhood_id_fkey" FOREIGN KEY ("neighborhood_id") REFERENCES "neighborhoods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Immutability Trigger: Prevent UPDATE or DELETE on account_phone_access_logs (append-only)
CREATE OR REPLACE FUNCTION prevent_account_phone_access_logs_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Updates and deletes are not allowed on account_phone_access_logs table';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_phone_access_logs_immutable_trigger
BEFORE UPDATE OR DELETE ON "account_phone_access_logs"
FOR EACH ROW
EXECUTE FUNCTION prevent_account_phone_access_logs_modification();
