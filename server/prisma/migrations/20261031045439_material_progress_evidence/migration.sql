-- AlterTable
ALTER TABLE "MaterialProgress" ADD COLUMN     "activeSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "fileOpenedAt" TIMESTAMP(3),
ADD COLUMN     "lastPingAt" TIMESTAMP(3),
ADD COLUMN     "seenSections" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "trackedRevision" INTEGER;
