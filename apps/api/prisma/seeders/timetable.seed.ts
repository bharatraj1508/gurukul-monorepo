import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

// Seeds the full timetable domain for the demo tenant:
// rooms, a Mon–Sat period template, ClassInstructorCourse assignments,
// per-class course allocations, teacher constraints, a PUBLISHED v1
// timetable (deterministic greedy placement — no solver/Redis required),
// a DRAFT v2 copy with a few moved slots, and dated substitutions.

const WORKING_DAYS = [1, 2, 3, 4, 5, 6]; // Mon–Sat
const PERIOD_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];
const MAX_PERIODS_PER_CLASS_WEEK = 44; // leave a few free cells in the 48-cell grid

interface TemplateSlotSeed {
  sortOrder: number;
  kind: string;
  label: string;
  startTime: string;
  endTime: string;
  periodNumber: number | null;
}

const TEMPLATE_SLOTS: TemplateSlotSeed[] = [
  {
    sortOrder: 0,
    kind: 'ASSEMBLY',
    label: 'Morning Assembly',
    startTime: '07:50',
    endTime: '08:10',
    periodNumber: null,
  },
  {
    sortOrder: 1,
    kind: 'PERIOD',
    label: 'Period 1',
    startTime: '08:10',
    endTime: '08:55',
    periodNumber: 1,
  },
  {
    sortOrder: 2,
    kind: 'PERIOD',
    label: 'Period 2',
    startTime: '08:55',
    endTime: '09:40',
    periodNumber: 2,
  },
  {
    sortOrder: 3,
    kind: 'PERIOD',
    label: 'Period 3',
    startTime: '09:40',
    endTime: '10:25',
    periodNumber: 3,
  },
  {
    sortOrder: 4,
    kind: 'PERIOD',
    label: 'Period 4',
    startTime: '10:25',
    endTime: '11:10',
    periodNumber: 4,
  },
  {
    sortOrder: 5,
    kind: 'BREAK',
    label: 'Short Break',
    startTime: '11:10',
    endTime: '11:30',
    periodNumber: null,
  },
  {
    sortOrder: 6,
    kind: 'PERIOD',
    label: 'Period 5',
    startTime: '11:30',
    endTime: '12:15',
    periodNumber: 5,
  },
  {
    sortOrder: 7,
    kind: 'PERIOD',
    label: 'Period 6',
    startTime: '12:15',
    endTime: '13:00',
    periodNumber: 6,
  },
  {
    sortOrder: 8,
    kind: 'LUNCH',
    label: 'Lunch Break',
    startTime: '13:00',
    endTime: '13:40',
    periodNumber: null,
  },
  {
    sortOrder: 9,
    kind: 'PERIOD',
    label: 'Period 7',
    startTime: '13:40',
    endTime: '14:25',
    periodNumber: 7,
  },
  {
    sortOrder: 10,
    kind: 'PERIOD',
    label: 'Period 8',
    startTime: '14:25',
    endTime: '15:10',
    periodNumber: 8,
  },
];

const ROOM_SEEDS = [
  { name: 'Physics Lab', type: 'SCIENCE_LAB', capacity: 40 },
  { name: 'Chemistry Lab', type: 'SCIENCE_LAB', capacity: 40 },
  { name: 'Biology Lab', type: 'SCIENCE_LAB', capacity: 40 },
  { name: 'Computer Lab A', type: 'COMPUTER_LAB', capacity: 40 },
  { name: 'Computer Lab B', type: 'COMPUTER_LAB', capacity: 40 },
  { name: 'Sports Ground', type: 'SPORTS', capacity: 200 },
  { name: 'Auditorium', type: 'AUDITORIUM', capacity: 500 },
];

interface AllocationRule {
  periodsPerWeek: number;
  blockSize: number;
  roomType: string | null;
}

// Weekly allocation by course slug (course.code is `${programCode}-${slug}`).
function ruleForSlug(slug: string): AllocationRule {
  if (slug === 'MATH' || slug === 'ENG') {
    return { periodsPerWeek: 6, blockSize: 1, roomType: null };
  }
  if (['SCI', 'PHY', 'CHE', 'BIO'].includes(slug)) {
    return { periodsPerWeek: 6, blockSize: 2, roomType: 'SCIENCE_LAB' };
  }
  if (slug === 'CS' || slug === 'IT') {
    return { periodsPerWeek: 4, blockSize: 2, roomType: 'COMPUTER_LAB' };
  }
  if (['HIN', 'SST', 'SAN', 'EVS'].includes(slug)) {
    return { periodsPerWeek: 5, blockSize: 1, roomType: null };
  }
  return { periodsPerWeek: 3, blockSize: 1, roomType: null };
}

function slugOfCourseCode(code: string): string {
  const idx = code.lastIndexOf('-');
  return idx >= 0 ? code.slice(idx + 1) : code;
}

const cellKey = (day: number, period: number) => `${day}:${period}`;
const entityKey = (id: string, day: number, period: number) =>
  `${id}:${day}:${period}`;

export async function seedTimetables(prismaClient?: PrismaClient) {
  let prisma = prismaClient;
  let pool: Pool | undefined;

  if (!prisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set.');
    pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
  }

  console.log('Seeding timetable domain...');

  const tenant = await prisma.tenant.findFirst({ where: { deletedAt: null } });
  if (!tenant) throw new Error('No tenant found — run the main seed first.');
  const tenantId = tenant.id;

  const term = await prisma.academicTerm.findFirst({
    where: { tenantId, isActive: true, deletedAt: null },
  });
  if (!term) throw new Error('No active academic term found.');

  // ---------- Rooms ----------
  const roomRows = ROOM_SEEDS.map((r) => ({
    id: randomUUID(),
    tenantId,
    ...r,
  }));
  await prisma.room.createMany({ data: roomRows });
  const roomsByType = new Map<string, { id: string; capacity: number }[]>();
  for (const r of roomRows) {
    const list = roomsByType.get(r.type) ?? [];
    list.push({ id: r.id, capacity: r.capacity });
    roomsByType.set(r.type, list);
  }

  // ---------- Period template ----------
  const periodTemplateId = randomUUID();
  await prisma.periodTemplate.create({
    data: {
      id: periodTemplateId,
      tenantId,
      name: 'Regular Day (Mon–Sat)',
      workingDays: WORKING_DAYS,
      slots: {
        create: TEMPLATE_SLOTS.map((s) => ({
          id: randomUUID(),
          sortOrder: s.sortOrder,
          kind: s.kind,
          label: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
          periodNumber: s.periodNumber,
        })),
      },
    },
  });

  // ---------- Load classes + instructors + program courses ----------
  const classes = await prisma.class.findMany({
    where: { tenantId, academicTermId: term.id, deletedAt: null },
    include: {
      program: {
        include: {
          courses: { where: { deletedAt: null }, orderBy: { code: 'asc' } },
        },
      },
      instructors: {
        where: { deletedAt: null },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      },
      enrolments: {
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  });
  if (classes.length === 0)
    throw new Error('No classes found for active term.');

  // ---------- ClassInstructorCourse + CourseAllocations ----------
  // Distribute each class's allocated courses round-robin across its
  // instructors (primary gets the first slice) and record the pairing in CIC
  // so the solver's snapshot service can resolve teachers later.
  const cicRows: {
    id: string;
    tenantId: string;
    classInstructorId: string;
    courseId: string;
  }[] = [];
  const allocationRows: {
    id: string;
    tenantId: string;
    classId: string;
    courseId: string;
    periodsPerWeek: number;
    consecutiveBlockSize: number;
    roomId: string | null;
    roomType: string | null;
  }[] = [];
  // teacher (membershipId) resolved per (classId, courseId) for the greedy placer
  const teacherByClassCourse = new Map<string, string>();

  for (const cls of classes) {
    if (cls.instructors.length === 0) continue;
    let total = 0;
    let courseIdx = 0;
    for (const course of cls.program.courses.slice(0, 8)) {
      const slug = slugOfCourseCode(course.code);
      const rule = ruleForSlug(slug);
      if (total + rule.periodsPerWeek > MAX_PERIODS_PER_CLASS_WEEK) continue;
      total += rule.periodsPerWeek;

      const instructor = cls.instructors[courseIdx % cls.instructors.length]!;
      cicRows.push({
        id: randomUUID(),
        tenantId,
        classInstructorId: instructor.id,
        courseId: course.id,
      });
      allocationRows.push({
        id: randomUUID(),
        tenantId,
        classId: cls.id,
        courseId: course.id,
        periodsPerWeek: rule.periodsPerWeek,
        consecutiveBlockSize: rule.blockSize,
        roomId: null,
        roomType: rule.roomType,
      });
      teacherByClassCourse.set(
        `${cls.id}:${course.id}`,
        instructor.tenantMembershipId,
      );
      courseIdx++;
    }
  }

  await prisma.classInstructorCourse.createMany({ data: cicRows });
  await prisma.courseAllocation.createMany({ data: allocationRows });

  // ---------- Teacher constraints ----------
  // Generous limits so out-of-the-box regeneration stays feasible.
  const teacherMembershipIds = Array.from(
    new Set(teacherByClassCourse.values()),
  );
  const constraintRows = teacherMembershipIds.slice(0, 20).map((mId, i) => ({
    id: randomUUID(),
    tenantId,
    tenantMembershipId: mId,
    maxPeriodsPerDay: 7,
    maxPeriodsPerWeek: 40,
    maxConsecutivePeriods: 4,
    // A couple of teachers are unavailable for Monday period 8.
    availability:
      i < 2
        ? {
            '1': [1, 2, 3, 4, 5, 6, 7],
            '2': PERIOD_NUMBERS,
            '3': PERIOD_NUMBERS,
            '4': PERIOD_NUMBERS,
            '5': PERIOD_NUMBERS,
            '6': PERIOD_NUMBERS,
          }
        : undefined,
  }));
  await prisma.teacherConstraint.createMany({ data: constraintRows });

  // ---------- Greedy placement for the PUBLISHED v1 timetable ----------
  // Collision-free by construction via busy maps; sessions rotate their
  // starting day so subjects spread across the week.
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();

  interface PlacedSlot {
    classId: string;
    dayOfWeek: number;
    periodNumber: number;
    courseId: string;
    teacherMembershipId: string;
    roomId: string | null;
  }
  const placedSlots: PlacedSlot[] = [];
  let unplacedSessions = 0;

  const allocationsByClass = new Map<string, typeof allocationRows>();
  for (const a of allocationRows) {
    const list = allocationsByClass.get(a.classId) ?? [];
    list.push(a);
    allocationsByClass.set(a.classId, list);
  }

  for (const cls of classes) {
    const allocations = allocationsByClass.get(cls.id) ?? [];
    const classBusy = new Set<string>();
    const studentCount = cls.enrolments.length;

    interface Session {
      courseId: string;
      teacherId: string;
      roomType: string | null;
      len: number;
    }
    const sessions: Session[] = [];
    for (const a of allocations) {
      const teacherId = teacherByClassCourse.get(`${a.classId}:${a.courseId}`)!;
      const count = a.periodsPerWeek / a.consecutiveBlockSize;
      for (let s = 0; s < count; s++) {
        sessions.push({
          courseId: a.courseId,
          teacherId,
          roomType: a.roomType,
          len: a.consecutiveBlockSize,
        });
      }
    }
    // Longer blocks are hardest to place — schedule them first.
    sessions.sort((a, b) => b.len - a.len);

    sessions.forEach((session, sIdx) => {
      let placed = false;
      for (let dOff = 0; dOff < WORKING_DAYS.length && !placed; dOff++) {
        const day = WORKING_DAYS[(sIdx + dOff) % WORKING_DAYS.length]!;
        for (
          let start = 1;
          start <= PERIOD_NUMBERS.length - session.len + 1 && !placed;
          start++
        ) {
          const covered = Array.from(
            { length: session.len },
            (_, i) => start + i,
          );
          const classFree = covered.every(
            (p) => !classBusy.has(cellKey(day, p)),
          );
          const teacherFree = covered.every(
            (p) => !teacherBusy.has(entityKey(session.teacherId, day, p)),
          );
          if (!classFree || !teacherFree) continue;

          let roomId: string | null = null;
          if (session.roomType) {
            const candidates = (roomsByType.get(session.roomType) ?? []).filter(
              (r) =>
                r.capacity >= studentCount &&
                covered.every((p) => !roomBusy.has(entityKey(r.id, day, p))),
            );
            if (candidates.length === 0) continue;
            roomId = candidates[0]!.id;
          }

          for (const p of covered) {
            classBusy.add(cellKey(day, p));
            teacherBusy.add(entityKey(session.teacherId, day, p));
            if (roomId) roomBusy.add(entityKey(roomId, day, p));
            placedSlots.push({
              classId: cls.id,
              dayOfWeek: day,
              periodNumber: p,
              courseId: session.courseId,
              teacherMembershipId: session.teacherId,
              roomId,
            });
          }
          placed = true;
        }
      }
      if (!placed) unplacedSessions++;
    });
  }

  // Soft-violation report: subjects appearing more than once on the same day.
  const perDayCount = new Map<string, number>();
  for (const s of placedSlots) {
    const k = `${s.classId}:${s.courseId}:${s.dayOfWeek}`;
    perDayCount.set(k, (perDayCount.get(k) ?? 0) + 1);
  }
  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const violations = Array.from(perDayCount.entries())
    .filter(([, count]) => count > 1)
    .slice(0, 10)
    .map(([k, count]) => {
      const [classId, courseId, day] = k.split(':');
      return {
        code: 'SUBJECT_NOT_SPREAD',
        message: `A subject repeats ${count}× on the same day for ${classNameById.get(classId!) ?? 'a class'}`,
        params: { classId, courseId, dayOfWeek: Number(day), count },
      };
    });

  const inputSnapshot = {
    schemaVersion: 1,
    grid: { workingDays: WORKING_DAYS, periodNumbers: PERIOD_NUMBERS },
    classes: classes.length,
    lessons: allocationRows.length,
    note: 'Seeded snapshot summary — regenerate for a full solver snapshot.',
    weights: { spread: 10, teacherBalance: 1 },
    limits: { timeLimitSeconds: 120 },
  };

  // ---------- Persist PUBLISHED v1 ----------
  const publishedId = randomUUID();
  await prisma.timetable.create({
    data: {
      id: publishedId,
      tenantId,
      academicTermId: term.id,
      periodTemplateId,
      name: 'Master Timetable v1',
      version: 1,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      inputSnapshot,
      violations,
      solverStats: {
        solverStatus: 'FEASIBLE',
        objectiveValue: violations.length,
        wallTimeMs: 4180,
        conflicts: 812,
        branches: 20455,
      },
    },
  });
  const v1SlotRows = placedSlots.map((s) => ({
    id: randomUUID(),
    tenantId,
    timetableId: publishedId,
    ...s,
  }));
  await prisma.timetableSlot.createMany({ data: v1SlotRows });

  // ---------- DRAFT v2: copy of v1 with a couple of slots moved ----------
  const draftId = randomUUID();
  await prisma.timetable.create({
    data: {
      id: draftId,
      tenantId,
      academicTermId: term.id,
      periodTemplateId,
      name: 'Master Timetable v2 (draft)',
      version: 2,
      status: 'DRAFT',
      inputSnapshot,
      violations,
      solverStats: {
        solverStatus: 'FEASIBLE',
        objectiveValue: violations.length,
        wallTimeMs: 3920,
        conflicts: 640,
        branches: 18211,
      },
    },
  });
  const draftSlots = placedSlots.map((s) => ({ ...s }));
  // Move the first class's last two placed slots into free cells (same class,
  // same teacher) when a conflict-free cell exists.
  const firstClassId = classes[0]!.id;
  const firstClassSlots = draftSlots.filter((s) => s.classId === firstClassId);
  const occupied = new Set(
    firstClassSlots.map((s) => cellKey(s.dayOfWeek, s.periodNumber)),
  );
  let moved = 0;
  for (let i = firstClassSlots.length - 1; i >= 0 && moved < 2; i--) {
    const slot = firstClassSlots[i]!;
    outer: for (const day of WORKING_DAYS) {
      for (const p of PERIOD_NUMBERS) {
        const free =
          !occupied.has(cellKey(day, p)) &&
          !teacherBusy.has(entityKey(slot.teacherMembershipId, day, p)) &&
          slot.roomId === null;
        if (free) {
          occupied.delete(cellKey(slot.dayOfWeek, slot.periodNumber));
          occupied.add(cellKey(day, p));
          slot.dayOfWeek = day;
          slot.periodNumber = p;
          moved++;
          break outer;
        }
      }
    }
  }
  await prisma.timetableSlot.createMany({
    data: draftSlots.map((s) => ({
      id: randomUUID(),
      tenantId,
      timetableId: draftId,
      ...s,
    })),
  });

  // ---------- Substitutions on the published timetable ----------
  // Six slots across different classes get a substitute within the next week.
  const substitutionRows: {
    id: string;
    tenantId: string;
    timetableSlotId: string;
    date: Date;
    substituteTeacherMembershipId: string;
    reason: string;
  }[] = [];
  const reasons = ['Medical leave', 'Training workshop', 'Personal leave'];
  const usedClasses = new Set<string>();
  const today = new Date();

  for (const slotRow of v1SlotRows) {
    if (substitutionRows.length >= 6) break;
    if (usedClasses.has(slotRow.classId)) continue;

    // Next calendar date (within 7 days) matching the slot's weekday.
    const date = new Date(today);
    const targetDow = slotRow.dayOfWeek % 7; // ISO -> JS Sunday=0
    while (date.getDay() !== targetDow) date.setDate(date.getDate() + 1);
    date.setHours(0, 0, 0, 0);
    if (date > term.endDate) continue;

    const substitute = teacherMembershipIds.find(
      (mId) =>
        mId !== slotRow.teacherMembershipId &&
        !teacherBusy.has(
          entityKey(mId, slotRow.dayOfWeek, slotRow.periodNumber),
        ),
    );
    if (!substitute) continue;

    usedClasses.add(slotRow.classId);
    substitutionRows.push({
      id: randomUUID(),
      tenantId,
      timetableSlotId: slotRow.id,
      date,
      substituteTeacherMembershipId: substitute,
      reason: reasons[substitutionRows.length % reasons.length]!,
    });
  }
  await prisma.timetableSubstitution.createMany({ data: substitutionRows });

  console.log(
    `Timetable seed done: ${roomRows.length} rooms, ${cicRows.length} instructor-course links, ` +
      `${allocationRows.length} allocations, ${constraintRows.length} teacher constraints, ` +
      `${v1SlotRows.length} published slots (${unplacedSessions} sessions unplaced), ` +
      `${substitutionRows.length} substitutions.`,
  );

  if (pool) {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Allow direct CLI execution
if (
  typeof process !== 'undefined' &&
  process.argv[1]?.includes('timetable.seed')
) {
  seedTimetables().catch((e) => {
    console.error('Error running timetable seeder:', e);
    process.exit(1);
  });
}
