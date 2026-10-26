-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMPTZ(3),
ADD COLUMN     "voided_by_id" UUID;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
