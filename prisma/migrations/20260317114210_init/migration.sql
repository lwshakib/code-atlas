-- CreateTable
CREATE TABLE "doc_page" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "codebaseId" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "doc_page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "codebaseId" TEXT NOT NULL,

    CONSTRAINT "recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "parts" JSONB NOT NULL,
    "codebaseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "doc_page_codebaseId_idx" ON "doc_page"("codebaseId");

-- CreateIndex
CREATE INDEX "recommendation_codebaseId_idx" ON "recommendation"("codebaseId");

-- CreateIndex
CREATE INDEX "message_codebaseId_idx" ON "message"("codebaseId");

-- AddForeignKey
ALTER TABLE "doc_page" ADD CONSTRAINT "doc_page_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doc_page" ADD CONSTRAINT "doc_page_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "doc_page"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation" ADD CONSTRAINT "recommendation_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
