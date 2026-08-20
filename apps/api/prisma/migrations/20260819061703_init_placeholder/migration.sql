-- CreateTable
CREATE TABLE "Placeholder" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Placeholder_pkey" PRIMARY KEY ("id")
);
