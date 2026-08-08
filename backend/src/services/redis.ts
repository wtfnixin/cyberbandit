import { createClient } from 'redis';
import { DirectoryNode } from '../engine/types';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = createClient({
  url: redisUrl
});

redis.on('error', (err) => console.error('Redis Client Error', err));

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
    console.log('Redis client successfully connected');
  }
}

// User-Specific VFS State
export async function getUserVFS(userId: string): Promise<DirectoryNode | null> {
  const data = await redis.get(`user:${userId}:vfs`);
  if (!data) return null;
  return JSON.parse(data) as DirectoryNode;
}

export async function setUserVFS(userId: string, vfs: DirectoryNode): Promise<void> {
  await redis.set(`user:${userId}:vfs`, JSON.stringify(vfs));
}

// User-Specific Working Directory
export async function getUserCWD(userId: string): Promise<string> {
  const cwd = await redis.get(`user:${userId}:cwd`);
  return cwd || '/home/student';
}

export async function setUserCWD(userId: string, cwd: string): Promise<void> {
  await redis.set(`user:${userId}:cwd`, cwd);
}

// Team Progress Management (Tracks competed tasks list)
export async function getTeamProgress(teamId: string): Promise<Record<string, string>> {
  const data = await redis.get(`team:${teamId}:progress`);
  if (!data) return {};
  return JSON.parse(data);
}

export async function setTeamProgress(teamId: string, progress: Record<string, string>): Promise<void> {
  await redis.set(`team:${teamId}:progress`, JSON.stringify(progress));
}

// Resets/Seeds a user's terminal workspace for a specific task template
export async function initializeUserSession(
  userId: string,
  initialVFS: DirectoryNode,
  startDirectory: string
): Promise<void> {
  const pipeline = redis.multi();
  pipeline.set(`user:${userId}:vfs`, JSON.stringify(initialVFS));
  pipeline.set(`user:${userId}:cwd`, startDirectory);
  pipeline.del(`user:${userId}:history`); // clear previous activity trace
  await pipeline.exec();
}

// Commands history hooks (for up/down arrow scroll)
export async function getHistory(userId: string): Promise<string[]> {
  return redis.lRange(`user:${userId}:history`, 0, -1);
}

export async function pushHistory(userId: string, commandLine: string): Promise<void> {
  const pipeline = redis.multi();
  pipeline.rPush(`user:${userId}:history`, commandLine);
  pipeline.lTrim(`user:${userId}:history`, -50, -1); // cap size to last 50 entries
  await pipeline.exec();
}

// Global leaderboard increment
export async function updateLeaderboardScore(teamId: string, score: number): Promise<void> {
  await redis.zAdd('leaderboard', {
    score: score,
    value: teamId
  });
}

// Fetches leaderboard ranking list
export async function getLeaderboard(): Promise<{ teamId: string; score: number }[]> {
  const list = await redis.zRangeWithScores('leaderboard', 0, -1, { REV: true });
  return list.map(item => ({
    teamId: item.value,
    score: item.score
  }));
}
