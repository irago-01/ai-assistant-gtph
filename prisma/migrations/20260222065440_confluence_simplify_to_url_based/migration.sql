/*
  Warnings:

  - You are about to drop the column `labels` on the `ConfluenceKeywordRule` table. All the data in the column will be lost.
  - You are about to drop the column `query` on the `ConfluenceKeywordRule` table. All the data in the column will be lost.
  - Added the required column `description` to the `ConfluenceKeywordRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pageUrl` to the `ConfluenceKeywordRule` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `ConfluenceKeywordRule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ConfluenceKeywordRule" DROP COLUMN "labels",
DROP COLUMN "query",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "pageUrl" TEXT NOT NULL,
ADD COLUMN     "title" TEXT NOT NULL;
