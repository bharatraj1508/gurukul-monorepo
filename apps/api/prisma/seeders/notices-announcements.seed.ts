import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { Pool } from 'pg';

export async function seedNoticesAndAnnouncements(prismaClient?: PrismaClient) {
  let prisma = prismaClient;
  let pool: Pool | undefined;

  if (!prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Add it to apps/api/.env before running the seed.',
      );
    }
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  }

  console.log('🌱 Seeding Notices and Announcements dynamically...');

  // 1. Fetch Tenant
  const tenant = await prisma.tenant.findFirst({
    where: { deletedAt: null },
  });

  if (!tenant) {
    console.error('❌ No tenant found in the database. Run main seed first.');
    if (pool) await pool.end();
    return;
  }

  const tenantId = tenant.id;

  // 2. Fetch Users (Admin/Principal, Teachers)
  const adminMembership = await prisma.tenantMembership.findFirst({
    where: { tenantId, deletedAt: null },
    include: { user: true },
  });

  const teacherMemberships = await prisma.tenantMembership.findMany({
    where: { tenantId, deletedAt: null },
    include: { user: true },
    take: 5,
  });

  const adminUserId = adminMembership?.userId ?? null;
  const teacherUser1 = teacherMemberships[0]?.userId ?? adminUserId;
  const teacherUser2 = teacherMemberships[1]?.userId ?? adminUserId;

  // 3. Fetch Classes
  const classes = await prisma.class.findMany({
    where: { tenantId, deletedAt: null },
    take: 6,
    select: { id: true, name: true },
  });

  if (classes.length === 0) {
    console.warn('⚠️ No classes found. Creating notices without class relations.');
  }

  const now = new Date();
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

  // 4. Seed School Announcements
  console.log('  -> Creating School Announcements...');

  // Approved active announcement
  await prisma.announcement.create({
    data: {
      tenantId,
      title: '🏆 Annual Sports Day & Cultural Fest 2026',
      content:
        '<h3>Dear Students and Parents,</h3><p>We are excited to announce our <strong>Annual Sports Day</strong> scheduled for next Friday. All students are required to assemble in their house uniforms by 8:30 AM.</p><ul><li>Track & Field Events</li><li>Cultural Performances</li><li>Prize Distribution Ceremony</li></ul>',
      status: 'APPROVED',
      approvedById: adminUserId,
      approvedAt: now,
      startDate: now,
      endDate: nextMonth,
      createdBy: adminUserId,
    },
  });

  // Pending approval announcement (submitted by teacher/HOD)
  await prisma.announcement.create({
    data: {
      tenantId,
      title: '🔬 Science Exhibition & Robot Showcase Proposal',
      content:
        '<p>Proposal for holding the annual <em>Inter-School Science Exhibition</em> in the main auditorium. Seeking approval for budget and dates.</p>',
      status: 'PENDING_APPROVAL',
      startDate: now,
      endDate: nextWeek,
      createdBy: teacherUser1,
    },
  });

  // Rejected announcement with feedback
  await prisma.announcement.create({
    data: {
      tenantId,
      title: '⛺ Overnight Camping Trip for Grade 10',
      content:
        '<p>Proposed 2-day wilderness camping excursion for 10th-grade students.</p>',
      status: 'REJECTED',
      rejectionReason:
        'Safety concerns and conflicts with the upcoming Mid-Term Examination schedule. Please reschedule for the next term.',
      approvedById: adminUserId,
      approvedAt: now,
      startDate: now,
      endDate: nextWeek,
      createdBy: teacherUser2,
    },
  });

  // Expired announcement (past endDate)
  await prisma.announcement.create({
    data: {
      tenantId,
      title: '📢 Parent-Teacher Meeting (Term 1)',
      content:
        '<p>Term 1 PTM was held successfully. Thank you all for your participation.</p>',
      status: 'APPROVED',
      approvedById: adminUserId,
      approvedAt: lastWeek,
      startDate: lastWeek,
      endDate: yesterday,
      createdBy: adminUserId,
    },
  });

  // 5. Seed Class & Staff Notices
  console.log('  -> Creating Class & Staff Notices...');

  // Active Class Notice for single/multiple classes
  if (classes.length > 0) {
    const classNotice = await prisma.notice.create({
      data: {
        tenantId,
        title: '📝 Mathematics Unit Test Schedule',
        content:
          '<p>A surprise unit test covering <strong>Algebra and Trigonometry</strong> will be conducted this Thursday. Please review chapters 3 and 4 thoroughly.</p>',
        scope: 'CLASS',
        startDate: now,
        endDate: nextWeek,
        createdBy: teacherUser1,
        classes: {
          create: [
            { classId: classes[0]!.id },
            ...(classes[1] ? [{ classId: classes[1].id }] : []),
          ],
        },
      },
    });
  }

  if (classes.length > 2) {
    await prisma.notice.create({
      data: {
        tenantId,
        title: '📚 Library Book Return Reminder',
        content:
          '<p>All students must return borrowed library books prior to term examinations to clear their library dues.</p>',
        scope: 'CLASS',
        startDate: now,
        endDate: nextWeek,
        createdBy: teacherUser2,
        classes: {
          create: [{ classId: classes[2]!.id }],
        },
      },
    });
  }

  // Teachers Only Notice
  await prisma.notice.create({
    data: {
      tenantId,
      title: '📌 Mandatory Staff Meeting - Curriculum Alignment',
      content:
        '<p>All department heads and teaching staff are requested to attend the monthly curriculum review meeting in Conference Hall B on Wednesday at 3:30 PM.</p>',
      scope: 'TEACHERS_ONLY',
      startDate: now,
      endDate: nextWeek,
      createdBy: adminUserId,
    },
  });

  console.log('✅ Notices and Announcements seeded successfully!');

  if (pool) {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Allow direct CLI execution
if (typeof process !== 'undefined' && process.argv[1]?.includes('notices-announcements.seed')) {
  seedNoticesAndAnnouncements().catch((e) => {
    console.error('Error running notices seeder:', e);
    process.exit(1);
  });
}
