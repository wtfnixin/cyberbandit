import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const name = args[0];
  const code = args[1]?.toUpperCase();

  if (!name || !code) {
    console.log('\x1b[1;31m[Error] Missing parameters.\x1b[0m');
    console.log('Usage: npx ts-node scripts/createTeam.ts "<Team Name>" "<INVITE_CODE>"');
    console.log('Example: npx ts-node scripts/createTeam.ts "HackSlayers" "SLAY789"');
    process.exit(1);
  }

  try {
    // Check if the invite code already exists
    const existing = await prisma.team.findUnique({
      where: { inviteCode: code }
    });

    if (existing) {
      console.log(`\x1b[1;31m[Error] A team with invite code "${code}" already exists (Team: ${existing.name}).\x1b[0m`);
      process.exit(1);
    }

    // Check if Level 1 exists to link correctly
    const lvl = await prisma.level.findFirst({
      orderBy: { id: 'asc' }
    });

    if (!lvl) {
      console.log('\x1b[1;31m[Error] No levels found in the database. Please run "npx ts-node prisma/seed.ts" first.\x1b[0m');
      process.exit(1);
    }

    // Create the team
    const team = await prisma.team.create({
      data: {
        name,
        inviteCode: code,
        score: 0,
        currentLevelId: lvl.id
      }
    });

    console.log('\n\x1b[1;32m========================================\x1b[0m');
    console.log(`\x1b[1;32m[SUCCESS] New Team Created!\x1b[0m`);
    console.log(`  Team Name:   ${team.name}`);
    console.log(`  Invite Code: ${team.inviteCode}`);
    console.log(`  Start Level: Level ${team.currentLevelId}`);
    console.log('\x1b[1;32m========================================\x1b[0m\n');
  } catch (error) {
    console.error('Failed to create team:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
