-- CreateTable
CREATE TABLE "codebase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "codebase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codebase_userId_idx" ON "codebase"("userId");

-- AddForeignKey
ALTER TABLE "codebase" ADD CONSTRAINT "codebase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
