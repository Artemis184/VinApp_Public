import { PrismaClient } from '@prisma/client';
import { initialSeed } from './seeds/initial.seed';
// aquí podrás agregar más seeds en el futuro

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Ejecutando seeds...');

  await initialSeed(prisma); // 👉 Ejecuta tu seed principal

  console.log('✅ Seeds ejecutadas correctamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error ejecutando seeds:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
