ALTER TABLE "User" ADD COLUMN "googleSubject" TEXT;
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
