import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  const levels = await prisma.level.findMany({
    include: { tasks: true }
  });
  fs.writeFileSync('db_snapshot.json', JSON.stringify(levels, null, 2), 'utf-8');
  console.log('Saved to db_snapshot.json');
}

main().catch(console.error).finally(() => prisma.$disconnect());
