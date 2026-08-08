import { PrismaClient, User, Team, Level, Task } from '@prisma/client';

export const prisma = new PrismaClient();

export async function getTeam(teamId: string): Promise<any> {
  return prisma.team.findUnique({
    where: { id: teamId },
    include: { users: true, currentLevel: { include: { tasks: true } } }
  }) as any;
}

export async function advanceTeamLevel(teamId: string, nextLevelId: number): Promise<any> {
  return prisma.team.update({
    where: { id: teamId },
    data: { currentLevelId: nextLevelId },
    include: { currentLevel: { include: { tasks: true } } }
  });
}

export async function recordSubmission(params: {
  teamId: string;
  userId: string;
  taskId: string;
  commandRun: string;
  isCorrect: boolean;
}): Promise<void> {
  await prisma.submission.create({
    data: {
      teamId: params.teamId,
      userId: params.userId,
      taskId: params.taskId,
      commandRun: params.commandRun,
      isCorrect: params.isCorrect
    }
  });

  // Calculate matching details
  if (params.isCorrect) {
    const task = await prisma.task.findUnique({ where: { id: params.taskId } });
    if (task) {
      const level = await prisma.level.findUnique({ where: { id: task.levelId } });
      if (level) {
        // Increment score for the team
        await prisma.team.update({
          where: { id: params.teamId },
          data: {
            score: {
              increment: level.points
            }
          }
        });
      }
    }
  }
}
