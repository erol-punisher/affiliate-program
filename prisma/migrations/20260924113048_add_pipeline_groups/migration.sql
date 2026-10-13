/*
  Warnings:

  - Added the required column `pipelineGroupId` to the `Pipeline` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "PipelineGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pipeline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "pipelineGroupId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pipeline_pipelineGroupId_fkey" FOREIGN KEY ("pipelineGroupId") REFERENCES "PipelineGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Pipeline" ("createdAt", "id", "name", "order", "updatedAt") SELECT "createdAt", "id", "name", "order", "updatedAt" FROM "Pipeline";
DROP TABLE "Pipeline";
ALTER TABLE "new_Pipeline" RENAME TO "Pipeline";
CREATE INDEX "Pipeline_pipelineGroupId_idx" ON "Pipeline"("pipelineGroupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
