-- AlterTable
ALTER TABLE "public"."Run"
ADD COLUMN "projectId" TEXT,
ADD COLUMN "environmentId" TEXT,
ADD COLUMN "dbId" TEXT,
ADD COLUMN "logEvents" JSONB;
