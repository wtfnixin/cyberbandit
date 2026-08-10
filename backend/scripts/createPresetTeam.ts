import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const TEAM_NAME = 'Alpha Team';
  const INVITE_CODE = 'OTW123';

  console.log(`Checking existing team with code "${INVITE_CODE}"...`);
  
  const existing = await prisma.team.findUnique({
    where: { inviteCode: INVITE_CODE }
  });

  if (existing) {
    console.log(`[!] Team already exists with code "${INVITE_CODE}". Name: "${existing.name}".`);
  } else {
    const newTeam = await prisma.team.create({
      data: {
        name: TEAM_NAME,
        inviteCode: INVITE_CODE,
        score: 0,
        currentLevelId: 1
      }
    });
    console.log(`[+] Team created successfully!`);
    console.log(`    Name:        "${newTeam.name}"`);
    console.log(`    Invite Code: "${newTeam.inviteCode}"`);
    console.log(`    Level ID:    ${newTeam.currentLevelId}`);
  }
}

main()
  .catch(err => {
    console.error('Error creating preset team:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
