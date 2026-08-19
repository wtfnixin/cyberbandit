import { FastifyInstance } from 'fastify';
import { prisma } from '../services/db';
import * as jwt from 'jsonwebtoken';
import { onlineUsers, forceRefreshAllStudents } from '../gateway/socket';
import { seedSystemLevels } from '../services/seedSyllabus';

const JWT_SECRET = process.env.JWT_SECRET || 'overthewiresupersecretkey123';

// Security: Strip HTML tags and dangerous characters from user inputs to prevent XSS
function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')        // strip all HTML tags
    .replace(/[<>"'`]/g, '')        // strip remaining angle brackets and quote chars
    .trim()
    .slice(0, 128);                 // hard cap at 128 characters
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function adminRoutes(fastify: FastifyInstance) {
  // Pre-handler hook to authenticate admin role
  fastify.addHook('preHandler', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        return reply.code(401).send({ error: 'Authorization header missing' });
      }
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded.role !== 'SUPER_ADMIN') {
        return reply.code(403).send({ error: 'Access forbidden: Admin privilege required' });
      }
    } catch (err) {
      return reply.code(401).send({ error: 'Unauthorized or invalid token' });
    }
  });

  // 1. Get all teams
  fastify.get('/api/admin/teams', async (request, reply) => {
    try {
      console.log(`[Admin API] Active online users count: ${onlineUsers.size}, set:`, Array.from(onlineUsers));
      const teams = await prisma.team.findMany({
        include: {
          users: true,
          currentLevel: true,
          allowedEmails: true
        },
        orderBy: {
          score: 'desc'
        }
      });
      const mapped = teams.map(team => {
        return {
          ...team,
          users: team.users.map(u => ({
            ...u,
            online: onlineUsers.has(u.id)
          }))
        };
      });
      return reply.send(mapped);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to fetch teams', details: err.message });
    }
  });

  // 2. Create a team (with optional pre-registered allowed members/emails)
  fastify.post('/api/admin/teams', async (request, reply) => {
    const { name, members } = request.body as {
      name: string;
      members?: Array<{ email: string; name?: string }>;
    };
    if (!name || !name.trim()) {
      return reply.code(400).send({ error: 'Team name is required' });
    }

    const sanitizedName = sanitizeInput(name);
    if (!sanitizedName) {
      return reply.code(400).send({ error: 'Team name contains invalid characters' });
    }

    try {
      const inviteCode = generateInviteCode();
      const team = await prisma.team.create({
        data: {
          name: sanitizedName,
          inviteCode,
          score: 0,
          currentLevelId: 1,
          allowedEmails: members && members.length > 0 ? {
            createMany: {
              data: members.map(m => ({
                email: m.email.trim().toLowerCase(),
                name: m.name ? sanitizeInput(m.name) : null
              }))
            }
          } : undefined
        },
        include: {
          allowedEmails: true
        }
      });
      return reply.code(201).send(team);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ error: 'Team name or pre-registered email is already taken' });
      }
      return reply.code(500).send({ error: 'Failed to create team', details: err.message });
    }
  });

  // 3. Delete a team
  fastify.delete('/api/admin/teams/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await prisma.submission.deleteMany({ where: { teamId: id } });
      await prisma.user.deleteMany({ where: { teamId: id } });
      await prisma.team.delete({ where: { id } });
      return reply.send({ message: 'Team deleted successfully' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to delete team', details: err.message });
    }
  });

  // 4. Get all submissions (live audit feed)
  fastify.get('/api/admin/submissions', async (request, reply) => {
    try {
      const submissions = await prisma.submission.findMany({
        include: {
          team: true,
          user: true,
          task: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 100
      });
      return reply.send(submissions);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to list submissions', details: err.message });
    }
  });

  // 5. Create a level
  fastify.post('/api/admin/levels', async (request, reply) => {
    const { id, title, description, points } = request.body as { id: number; title: string; description: string; points: number };
    if (!id || !title || !description || points === undefined) {
      return reply.code(400).send({ error: 'All fields (id, title, description, points) are required' });
    }

    try {
      const level = await prisma.level.create({
        data: {
          id: Number(id),
          title: title.trim(),
          description: description.trim(),
          points: Number(points)
        }
      });
      return reply.code(201).send(level);
    } catch (err: any) {
      if (err.code === 'P2002') {
        return reply.code(400).send({ error: 'Level ID is already taken' });
      }
      return reply.code(500).send({ error: 'Failed to create level', details: err.message });
    }
  });

  // 6. Create a task
  fastify.post('/api/admin/tasks', async (request, reply) => {
    const { levelId, name, taskRole, startDirectory, initialVFS, validationType, validationTarget, hintText } = request.body as {
      levelId: number;
      name: string;
      taskRole: string;
      startDirectory: string;
      initialVFS: any;
      validationType: 'COMMAND' | 'FILE' | 'OUTPUT';
      validationTarget: string;
      hintText?: string;
    };

    if (!levelId || !name || !taskRole || !validationType || !validationTarget) {
      return reply.code(400).send({ error: 'Missing required parameters' });
    }

    try {
      const task = await prisma.task.create({
        data: {
          levelId: Number(levelId),
          name: name.trim(),
          taskRole: taskRole.trim(),
          startDirectory: startDirectory ? startDirectory.trim() : '/home/student',
          initialVFS: initialVFS || {
            name: '/',
            type: 'directory',
            permissions: '755',
            children: {
              home: {
                name: 'home',
                type: 'directory',
                permissions: '755',
                children: {
                  student: {
                    name: 'student',
                    type: 'directory',
                    permissions: '700',
                    children: {}
                  }
                }
              }
            }
          },
          validationType,
          validationTarget: validationTarget.trim(),
          hintText: hintText ? hintText.trim() : null
        }
      });
      return reply.code(201).send(task);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to create task', details: err.message });
    }
  });

  // 7. Get all levels (for selector)
  fastify.get('/api/admin/levels', async (request, reply) => {
    try {
      const levels = await prisma.level.findMany({
        include: { tasks: true },
        orderBy: { id: 'asc' }
      });
      return reply.send(levels);
    } catch (err: any) {
      return reply.code(500).send({ error: 'Failed to list levels', details: err.message });
    }
  });

  // 8. Bulk seed all 20 levels
  fastify.post('/api/admin/seed', async (request, reply) => {
    try {
      await seedSystemLevels();
      const io = (fastify as any).io;
      if (io) {
        await forceRefreshAllStudents(io);
      }
      return reply.code(200).send({ message: 'Successfully seeded 20 levels' });
    } catch (err: any) {
      return reply.code(500).send({ error: 'Seeding failed', details: err.message });
    }
  });
}
