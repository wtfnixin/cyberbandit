CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "streakCount" INTEGER NOT NULL DEFAULT 0,
    "currentLevelId" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");
CREATE UNIQUE INDEX "Team_inviteCode_key" ON "Team"("inviteCode");

CREATE TABLE "Level" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "points" INTEGER NOT NULL DEFAULT 100,
    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "levelId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "taskRole" TEXT NOT NULL DEFAULT 'TASK_A',
    "points" INTEGER NOT NULL DEFAULT 50,
    "startDirectory" TEXT NOT NULL DEFAULT '/home/student',
    "validationType" TEXT NOT NULL DEFAULT 'OUTPUT',
    "validationTarget" TEXT NOT NULL,
    "hintText" TEXT NOT NULL DEFAULT '',
    "initialVFS" JSONB NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "timestamp" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT,
    "email" TEXT,
    "isGlobalAdmin" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

ALTER TABLE "Task" ADD CONSTRAINT "Task_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Team" ADD CONSTRAINT "Team_currentLevelId_fkey" FOREIGN KEY ("currentLevelId") REFERENCES "Level"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
