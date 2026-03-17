-- CreateEnum
CREATE TYPE "CodebaseStatus" AS ENUM ('PENDING', 'INDEXING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "codebase" ADD COLUMN     "status" "CodebaseStatus" NOT NULL DEFAULT 'PENDING';
