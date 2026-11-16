const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const istDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function getISTDate(daysOffset = 0) {
  const istStr = istDateFormatter.format(new Date());
  if (daysOffset === 0) return istStr;
  const [y, m, d] = istStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d + daysOffset));
  return dateObj.toISOString().slice(0, 10);
}

async function main() {
  console.log('Seeding TeerResult2 verified architecture (Strictly No demo data)...');

  // 1. Initial Admin User Setup (Strictly require ADMIN_INITIAL_PASSWORD from environment)
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const rawPassword = process.env.ADMIN_INITIAL_PASSWORD;

  if (!rawPassword) {
    console.error('CRITICAL ERROR: ADMIN_INITIAL_PASSWORD is not set in the environment.');
    console.error('To protect production security, a strong ADMIN_INITIAL_PASSWORD must be configured in .env before seeding.');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(rawPassword, 12);

  await prisma.adminUser.upsert({
    where: { username: adminUsername },
    update: { passwordHash },
    create: {
      username: adminUsername,
      passwordHash,
      name: 'Editorial Desk',
      role: 'ADMIN',
    },
  });

  // 2. Official Primary Categories
  const categories = [
    {
      name: 'Shillong Teer',
      slug: 'shillong-teer',
      location: 'Polo Grounds, Shillong, Meghalaya',
      round1Time: '03:45 PM',
      round2Time: '04:45 PM',
      description: 'Official Khasi Hills Archery Sports Association daily competition results.',
      order: 1,
    },
    {
      name: 'Khanapara Teer',
      slug: 'khanapara-teer',
      location: 'Ri-Bhoi District, Assam/Meghalaya Border',
      round1Time: '04:10 PM',
      round2Time: '04:45 PM',
      description: 'Daily Guwahati / Khanapara traditional archery outcome.',
      order: 2,
    },
    {
      name: 'Juwai Teer',
      slug: 'juwai-teer',
      location: 'Jowai, West Jaintia Hills, Meghalaya',
      round1Time: '02:05 PM',
      round2Time: '02:45 PM',
      description: 'West Jaintia Hills afternoon archery session results.',
      order: 3,
    },
    {
      name: 'Shillong Night Teer',
      slug: 'shillong-night-teer',
      location: 'Polo Grounds / Authorized Club (Night Session)',
      round1Time: '10:15 PM',
      round2Time: '11:15 PM',
      description: 'Night edition archery session outcome in Meghalaya.',
      order: 4,
    },
  ];

  const catMap = {};
  for (const cat of categories) {
    const record = await prisma.gameCategory.upsert({
      where: { slug: cat.slug },
      update: cat,
      create: cat,
    });
    catMap[cat.slug] = record.id;
  }

  // 3. Purge any previous fabricated demo numbers
  await prisma.teerResult.deleteMany({
    where: {
      sourceInfo: {
        in: ['Historical Archive', 'Sample Seed Data', 'Algorithmic Demo', 'Demo Seed'],
      },
    },
  });

  // 4. Initialize Today's Official Schedule (Strictly Pending - No fabricated numbers)
  const todayStr = getISTDate(0);
  for (const cat of categories) {
    await prisma.teerResult.upsert({
      where: {
        categoryId_dateStr: {
          categoryId: catMap[cat.slug],
          dateStr: todayStr,
        },
      },
      update: {},
      create: {
        categoryId: catMap[cat.slug],
        dateStr: todayStr,
        round1: null,
        round2: null,
        status: 'PENDING',
        isVerified: false,
        sourceInfo: 'Awaiting Official Ground Declaration',
      },
    });
  }

  console.log('TeerResult2 database ready: 0 demo records, categories verified, pending states initialized.');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
