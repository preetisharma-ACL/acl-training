-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- The company's offices.
INSERT INTO "Location" ("id", "name", "updatedAt") VALUES
    ('loc-lucknow', 'Lucknow', CURRENT_TIMESTAMP),
    ('loc-noida', 'Noida', CURRENT_TIMESTAMP),
    ('loc-kolkata', 'Kolkata', CURRENT_TIMESTAMP);

-- Existing records: "Lucknow HQ" becomes "Lucknow"; places that aren't an
-- office (Gurugram, Delhi, Remote, ...) are cleared.
UPDATE "User" SET "location" = 'Lucknow' WHERE "location" ILIKE 'lucknow%';
UPDATE "User" SET "location" = '' WHERE "location" NOT IN ('Lucknow', 'Noida', 'Kolkata');
UPDATE "Department" SET "location" = 'Lucknow' WHERE "location" ILIKE 'lucknow%';
UPDATE "Department" SET "location" = '' WHERE "location" NOT IN ('Lucknow', 'Noida', 'Kolkata');
