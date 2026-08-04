import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

import { DEFAULT_ROLES } from '@repo/permissions';
import { seedNoticesAndAnnouncements } from './seeders/notices-announcements.seed';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Add it to apps/api/.env before running the seed.',
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const hashPassword = (pwd: string): string => bcrypt.hashSync(pwd, 10);
const DEFAULT_PASSWORD = 'password123';

const TENANT_NAME = 'Shanti Niketan Vidyalaya';
const TENANT_SUBDOMAIN = 'shanti-niketan';
const TERM_NAME = '2026-27 Academic Year';
const TERM_START = new Date('2026-04-01');
const TERM_END = new Date('2027-03-31');
const SECTION_FLOWERS = [
  'Lotus',
  'Rose',
  'Jasmine',
  'Lily',
  'Sunflower',
  'Marigold',
] as const;
const CLASS_MAX_CAPACITY = 35;
const STUDENTS_PER_SECTION = 25;
const EXTRA_TEACHERS = 95;
const ASSISTANTS_PER_CLASS = 2;

type GradeBucket =
  | 'PRE_PRIMARY'
  | 'PRIMARY'
  | 'MIDDLE'
  | 'SECONDARY'
  | 'SENIOR_SECONDARY';

interface ProgramSeed {
  code: string;
  name: string;
  bucket: GradeBucket;
}

const PROGRAMS: readonly ProgramSeed[] = [
  { code: 'PRG-NUR', name: 'Nursery Program', bucket: 'PRE_PRIMARY' },
  { code: 'PRG-LKG', name: 'LKG Program', bucket: 'PRE_PRIMARY' },
  { code: 'PRG-UKG', name: 'UKG Program', bucket: 'PRE_PRIMARY' },
  { code: 'PRG-G01', name: '1st Class Program', bucket: 'PRIMARY' },
  { code: 'PRG-G02', name: '2nd Class Program', bucket: 'PRIMARY' },
  { code: 'PRG-G03', name: '3rd Class Program', bucket: 'PRIMARY' },
  { code: 'PRG-G04', name: '4th Class Program', bucket: 'PRIMARY' },
  { code: 'PRG-G05', name: '5th Class Program', bucket: 'PRIMARY' },
  { code: 'PRG-G06', name: '6th Grade Program', bucket: 'MIDDLE' },
  { code: 'PRG-G07', name: '7th Grade Program', bucket: 'MIDDLE' },
  { code: 'PRG-G08', name: '8th Grade Program', bucket: 'MIDDLE' },
  { code: 'PRG-G09', name: '9th Grade Program', bucket: 'SECONDARY' },
  { code: 'PRG-G10', name: '10th Grade Program', bucket: 'SECONDARY' },
  { code: 'PRG-G11', name: '11th Grade Program', bucket: 'SENIOR_SECONDARY' },
  { code: 'PRG-G12', name: '12th Grade Program', bucket: 'SENIOR_SECONDARY' },
];

interface CourseTemplate {
  slug: string;
  name: string;
  credits?: number;
}

const COURSES_BY_BUCKET: Record<GradeBucket, readonly CourseTemplate[]> = {
  PRE_PRIMARY: [
    { slug: 'ENG', name: 'English' },
    { slug: 'MATH', name: 'Mathematics (Numbers)' },
    { slug: 'EVS', name: 'Environmental Studies (EVS)' },
    { slug: 'RHYMES', name: 'Rhymes & Storytelling' },
    { slug: 'ART', name: 'Art & Craft' },
  ],
  PRIMARY: [
    { slug: 'ENG', name: 'English Core' },
    { slug: 'HIN', name: 'Hindi (Second Language)' },
    { slug: 'MATH', name: 'Mathematics' },
    { slug: 'EVS', name: 'Environmental Studies (EVS)' },
    { slug: 'CS', name: 'Computer Science' },
    { slug: 'GK', name: 'General Knowledge (GK)' },
    { slug: 'ART', name: 'Art & Craft' },
  ],
  MIDDLE: [
    { slug: 'ENG', name: 'English Literature & Grammar' },
    { slug: 'HIN', name: 'Hindi Course A' },
    { slug: 'SAN', name: 'Sanskrit (Third Language)' },
    { slug: 'MATH', name: 'Mathematics' },
    { slug: 'SCI', name: 'General Science' },
    { slug: 'SST', name: 'Social Science' },
    { slug: 'CS', name: 'Computer Studies' },
  ],
  SECONDARY: [
    { slug: 'ENG', name: 'English Communicative' },
    { slug: 'HIN', name: 'Hindi Course B' },
    { slug: 'MATH', name: 'Mathematics (Standard)' },
    { slug: 'SCI', name: 'Science' },
    { slug: 'SST', name: 'Social Science' },
    { slug: 'IT', name: 'Information Technology' },
  ],
  SENIOR_SECONDARY: [
    { slug: 'ENG', name: 'English Core', credits: 4 },
    { slug: 'PHY', name: 'Physics', credits: 4 },
    { slug: 'CHE', name: 'Chemistry', credits: 4 },
    { slug: 'MATH', name: 'Mathematics', credits: 4 },
    { slug: 'BIO', name: 'Biology', credits: 4 },
    { slug: 'CS', name: 'Computer Science', credits: 4 },
    { slug: 'ACC', name: 'Accountancy', credits: 4 },
    { slug: 'BST', name: 'Business Studies', credits: 4 },
    { slug: 'ECO', name: 'Economics', credits: 4 },
    { slug: 'AMATH', name: 'Applied Mathematics', credits: 4 },
    { slug: 'HIS', name: 'History', credits: 4 },
    { slug: 'POL', name: 'Political Science', credits: 4 },
    { slug: 'GEO', name: 'Geography', credits: 4 },
    { slug: 'SOC', name: 'Sociology', credits: 4 },
    { slug: 'PSY', name: 'Psychology', credits: 4 },
  ],
};

// ---------- Indian name pools (deterministic index selection) ----------

const MALE_FIRSTS = [
  'Aarav',
  'Vihaan',
  'Arjun',
  'Reyansh',
  'Krishna',
  'Ishaan',
  'Rohan',
  'Aditya',
  'Vivaan',
  'Kabir',
  'Aryan',
  'Om',
  'Rudra',
  'Shivansh',
  'Advik',
  'Ansh',
  'Rishab',
  'Yash',
  'Neel',
  'Karan',
  'Rahul',
  'Amit',
  'Rajesh',
  'Vikram',
  'Suresh',
  'Anil',
  'Ravi',
  'Manish',
  'Ashok',
  'Deepak',
  'Sanjay',
  'Vinod',
  'Prakash',
  'Kishore',
  'Naveen',
  'Suraj',
  'Anand',
  'Sandeep',
  'Ramesh',
  'Ajay',
  'Nikhil',
  'Varun',
  'Siddharth',
  'Rohit',
  'Harsh',
  'Gaurav',
  'Tushar',
  'Aakash',
  'Dhruv',
  'Kunal',
];

const FEMALE_FIRSTS = [
  'Diya',
  'Ananya',
  'Aadhya',
  'Pari',
  'Sara',
  'Isha',
  'Riya',
  'Kavya',
  'Anaya',
  'Kiara',
  'Myra',
  'Aarohi',
  'Anika',
  'Navya',
  'Aditi',
  'Anvi',
  'Anushka',
  'Trisha',
  'Nisha',
  'Priya',
  'Sneha',
  'Anjali',
  'Meena',
  'Kavita',
  'Sunita',
  'Rekha',
  'Sushma',
  'Pooja',
  'Neha',
  'Deepika',
  'Radha',
  'Geeta',
  'Lakshmi',
  'Shreya',
  'Ritika',
  'Nandini',
  'Divya',
  'Swati',
  'Manisha',
  'Payal',
  'Rachna',
  'Simran',
  'Tanvi',
  'Vandana',
  'Yamini',
  'Aparna',
  'Bhavna',
  'Charu',
  'Esha',
  'Falguni',
];

const LAST_NAMES = [
  'Sharma',
  'Verma',
  'Gupta',
  'Singh',
  'Kumar',
  'Patel',
  'Shah',
  'Mehta',
  'Rao',
  'Reddy',
  'Iyer',
  'Nair',
  'Menon',
  'Pillai',
  'Chatterjee',
  'Banerjee',
  'Mukherjee',
  'Das',
  'Ghosh',
  'Sen',
  'Roy',
  'Bose',
  'Chakraborty',
  'Joshi',
  'Deshmukh',
  'Kulkarni',
  'Pawar',
  'Jadhav',
  'Chauhan',
  'Rathore',
  'Yadav',
  'Mishra',
  'Tiwari',
  'Pandey',
  'Trivedi',
  'Agarwal',
  'Bansal',
  'Aggarwal',
  'Goyal',
  'Mittal',
  'Khanna',
  'Kapoor',
  'Chopra',
  'Malhotra',
  'Bajaj',
  'Saxena',
  'Srivastava',
  'Bhardwaj',
  'Chauhan',
  'Sinha',
];

interface Person {
  firstName: string;
  lastName: string;
  gender: 'M' | 'F';
}

function pickPerson(index: number): Person {
  const pool = index % 2 === 0 ? MALE_FIRSTS : FEMALE_FIRSTS;
  const firstName = pool[Math.floor(index / 2) % pool.length]!;
  const lastName = LAST_NAMES[index % LAST_NAMES.length]!;
  const gender: 'M' | 'F' = index % 2 === 0 ? 'M' : 'F';
  return { firstName, lastName, gender };
}

function makePhone(index: number): string {
  const digits = (9000000000 + index).toString();
  return `+91-${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// ---------- Cleanup ----------

async function cleanup(): Promise<void> {
  await prisma.enrolment.deleteMany();
  await prisma.studentParent.deleteMany();
  await prisma.parentProfile.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.classInstructor.deleteMany();
  await prisma.class.deleteMany();
  await prisma.course.deleteMany();
  await prisma.program.deleteMany();
  await prisma.membershipRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.academicTerm.deleteMany();
  await prisma.tenant.deleteMany();
}

// ---------- Core entities ----------

async function seedTenant(): Promise<string> {
  const tenant = await prisma.tenant.create({
    data: {
      name: TENANT_NAME,
      subdomain: TENANT_SUBDOMAIN,
      type: 'SCHOOL',
      settings: {
        board: 'CBSE',
        country: 'IN',
        locale: 'en-IN',
        timezone: 'Asia/Kolkata',
      },
    },
  });
  return tenant.id;
}

async function seedRoles(tenantId: string): Promise<Map<string, string>> {
  const roleIdByTitle = new Map<string, string>();
  for (const def of DEFAULT_ROLES) {
    const role = await prisma.role.create({
      data: {
        tenantId,
        name: def.title,
        rank: def.rank,
        isAdmin: def.isAdmin,
        isSystemRole: true,
      },
    });
    roleIdByTitle.set(def.title, role.id);
    if (def.scopes.length > 0) {
      await prisma.rolePermission.createMany({
        data: def.scopes.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }
  return roleIdByTitle;
}

async function seedAcademicTerm(tenantId: string): Promise<string> {
  const term = await prisma.academicTerm.create({
    data: {
      tenantId,
      name: TERM_NAME,
      startDate: TERM_START,
      endDate: TERM_END,
      isActive: true,
    },
  });
  return term.id;
}

// ---------- Bulk user helpers ----------

interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isSuperAdmin: boolean;
}

interface MembershipRow {
  id: string;
  tenantId: string;
  userId: string;
  status: string;
  joinedAt: Date;
}

interface MembershipRoleRow {
  id: string;
  tenantMembershipId: string;
  roleId: string;
}

interface PersonRecord {
  userId: string;
  membershipId: string;
  firstName: string;
  lastName: string;
  email: string;
}

function buildPerson(params: {
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  isSuperAdmin: boolean;
  passwordHash: string;
  roleId: string;
  userRows: UserRow[];
  membershipRows: MembershipRow[];
  roleAssignments: MembershipRoleRow[];
}): PersonRecord {
  const userId = randomUUID();
  const membershipId = randomUUID();
  params.userRows.push({
    id: userId,
    email: params.email,
    passwordHash: params.passwordHash,
    firstName: params.firstName,
    lastName: params.lastName,
    phone: params.phone,
    isSuperAdmin: params.isSuperAdmin,
  });
  params.membershipRows.push({
    id: membershipId,
    tenantId: params.tenantId,
    userId,
    status: 'ACTIVE',
    joinedAt: new Date(),
  });
  params.roleAssignments.push({
    id: randomUUID(),
    tenantMembershipId: membershipId,
    roleId: params.roleId,
  });
  return {
    userId,
    membershipId,
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
  };
}

async function batchCreate<T>(
  create: (chunk: T[]) => Promise<unknown>,
  rows: T[],
  chunkSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await create(rows.slice(i, i + chunkSize));
  }
}

// ---------- Programs, courses, classes ----------

async function seedPrograms(
  tenantId: string,
): Promise<Map<string, { id: string; bucket: GradeBucket }>> {
  const programByCode = new Map<string, { id: string; bucket: GradeBucket }>();
  for (const program of PROGRAMS) {
    const created = await prisma.program.create({
      data: {
        tenantId,
        name: program.name,
        code: program.code,
        description: `${program.name} (${program.code})`,
      },
    });
    programByCode.set(program.code, { id: created.id, bucket: program.bucket });
  }
  return programByCode;
}

async function seedCourses(
  tenantId: string,
  programByCode: Map<string, { id: string; bucket: GradeBucket }>,
): Promise<void> {
  const courseRows: {
    id: string;
    tenantId: string;
    programId: string;
    name: string;
    code: string;
    credits?: number | null;
  }[] = [];
  for (const program of PROGRAMS) {
    const entry = programByCode.get(program.code);
    if (!entry) continue;
    for (const template of COURSES_BY_BUCKET[program.bucket]) {
      courseRows.push({
        id: randomUUID(),
        tenantId,
        programId: entry.id,
        name: template.name,
        code: `${program.code}-${template.slug}`,
        credits: template.credits ?? null,
      });
    }
  }
  await batchCreate(
    (chunk) => prisma.course.createMany({ data: chunk }),
    courseRows,
  );
}

interface ClassRow {
  id: string;
  programCode: string;
  sectionName: string;
}

async function seedClasses(
  tenantId: string,
  academicTermId: string,
  programByCode: Map<string, { id: string; bucket: GradeBucket }>,
): Promise<ClassRow[]> {
  const rows: {
    id: string;
    tenantId: string;
    academicTermId: string;
    programId: string;
    name: string;
    maxCapacity: number;
    status: string;
  }[] = [];
  const classes: ClassRow[] = [];
  for (const program of PROGRAMS) {
    const entry = programByCode.get(program.code);
    if (!entry) continue;
    for (const flower of SECTION_FLOWERS) {
      const id = randomUUID();
      rows.push({
        id,
        tenantId,
        academicTermId,
        programId: entry.id,
        name: flower,
        maxCapacity: CLASS_MAX_CAPACITY,
        status: 'ACTIVE',
      });
      classes.push({ id, programCode: program.code, sectionName: flower });
    }
  }
  await batchCreate((chunk) => prisma.class.createMany({ data: chunk }), rows);
  return classes;
}

// ---------- Main orchestration ----------

async function main(): Promise<void> {
  const started = Date.now();
  console.log('Starting DB seeding...');

  console.log('Cleaning up existing data...');
  await cleanup();

  console.log('Seeding tenant...');
  const tenantId = await seedTenant();

  console.log('Seeding default roles and permissions...');
  const roleIdByTitle = await seedRoles(tenantId);
  const roleId = (title: string): string => {
    const id = roleIdByTitle.get(title);
    if (!id) throw new Error(`Missing role ${title}`);
    return id;
  };

  console.log('Seeding academic term...');
  const academicTermId = await seedAcademicTerm(tenantId);

  console.log('Seeding programs...');
  const programByCode = await seedPrograms(tenantId);

  console.log('Seeding courses...');
  await seedCourses(tenantId, programByCode);

  console.log('Seeding class sections...');
  const classes = await seedClasses(tenantId, academicTermId, programByCode);

  // ---------- Users ----------
  console.log('Building user rows...');
  const passwordHash = hashPassword(DEFAULT_PASSWORD);
  const userRows: UserRow[] = [];
  const membershipRows: MembershipRow[] = [];
  const roleAssignments: MembershipRoleRow[] = [];

  // Super Admin (Account Owner)
  buildPerson({
    tenantId,
    firstName: 'Super',
    lastName: 'Admin',
    email: 'superadmin@gurukul.local',
    phone: null,
    isSuperAdmin: true,
    passwordHash,
    roleId: roleId('Account Owner'),
    userRows,
    membershipRows,
    roleAssignments,
  });

  // School Admins (named for demo login)
  buildPerson({
    tenantId,
    firstName: 'Rajesh',
    lastName: 'Sharma',
    email: 'rajesh.sharma@shanti-niketan.local',
    phone: '+91-98100-11111',
    isSuperAdmin: false,
    passwordHash,
    roleId: roleId('Coordinators'),
    userRows,
    membershipRows,
    roleAssignments,
  });
  buildPerson({
    tenantId,
    firstName: 'Anjali',
    lastName: 'Mehta',
    email: 'anjali.mehta@shanti-niketan.local',
    phone: '+91-98100-11112',
    isSuperAdmin: false,
    passwordHash,
    roleId: roleId('Coordinators'),
    userRows,
    membershipRows,
    roleAssignments,
  });

  // Teachers: 5 named + EXTRA_TEACHERS generated = 100 total
  const namedTeachers: readonly {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }[] = [
    {
      firstName: 'Sunita',
      lastName: 'Rao',
      email: 'sunita.rao@shanti-niketan.local',
      phone: '+91-98100-22001',
    },
    {
      firstName: 'Ramesh',
      lastName: 'Gupta',
      email: 'ramesh.gupta@shanti-niketan.local',
      phone: '+91-98100-22002',
    },
    {
      firstName: 'Priya',
      lastName: 'Nair',
      email: 'priya.nair@shanti-niketan.local',
      phone: '+91-98100-22003',
    },
    {
      firstName: 'Vikram',
      lastName: 'Patel',
      email: 'vikram.patel@shanti-niketan.local',
      phone: '+91-98100-22004',
    },
    {
      firstName: 'Ananya',
      lastName: 'Iyer',
      email: 'ananya.iyer@shanti-niketan.local',
      phone: '+91-98100-22005',
    },
  ];

  const teachers: PersonRecord[] = [];
  for (const t of namedTeachers) {
    teachers.push(
      buildPerson({
        tenantId,
        firstName: t.firstName,
        lastName: t.lastName,
        email: t.email,
        phone: t.phone,
        isSuperAdmin: false,
        passwordHash,
        roleId: roleId('Teacher'),
        userRows,
        membershipRows,
        roleAssignments,
      }),
    );
  }
  for (let i = 0; i < EXTRA_TEACHERS; i++) {
    const p = pickPerson(i);
    teachers.push(
      buildPerson({
        tenantId,
        firstName: p.firstName,
        lastName: p.lastName,
        email: `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}.t${i + 1}@shanti-niketan.local`,
        phone: makePhone(220000 + i),
        isSuperAdmin: false,
        passwordHash,
        roleId: roleId('Teacher'),
        userRows,
        membershipRows,
        roleAssignments,
      }),
    );
  }

  // Students & Parents: STUDENTS_PER_SECTION per class, one parent per student
  interface StudentRecord extends PersonRecord {
    classId: string;
    programCode: string;
    rollNumber: string;
    studentProfileId: string;
    parentProfileId: string;
    parentRelationship: 'FATHER' | 'MOTHER';
  }

  const students: StudentRecord[] = [];
  const parents: PersonRecord[] = [];
  let studentSeq = 0;

  for (const cls of classes) {
    const gradeToken = cls.programCode.replace(/^PRG-/, '');
    for (let s = 0; s < STUDENTS_PER_SECTION; s++) {
      const studentIdx = studentSeq++;
      const child = pickPerson(studentIdx);
      const rollNumber = `2026-${gradeToken}-${cls.sectionName.slice(0, 3).toUpperCase()}-${String(s + 1).padStart(2, '0')}`;
      const studentEmail = `${child.firstName.toLowerCase()}.${child.lastName.toLowerCase()}.s${studentIdx + 1}@student.shanti-niketan.local`;
      const studentPerson = buildPerson({
        tenantId,
        firstName: child.firstName,
        lastName: child.lastName,
        email: studentEmail,
        phone: null,
        isSuperAdmin: false,
        passwordHash,
        roleId: roleId('Student'),
        userRows,
        membershipRows,
        roleAssignments,
      });

      const parentIsMother = studentIdx % 2 === 0;
      const parentPool = parentIsMother ? FEMALE_FIRSTS : MALE_FIRSTS;
      const parentFirst =
        parentPool[Math.floor(studentIdx / 2) % parentPool.length]!;
      const parentEmail = `${parentFirst.toLowerCase()}.${child.lastName.toLowerCase()}.p${studentIdx + 1}@parent.shanti-niketan.local`;
      const parentPerson = buildPerson({
        tenantId,
        firstName: parentFirst,
        lastName: child.lastName,
        email: parentEmail,
        phone: makePhone(430000 + studentIdx),
        isSuperAdmin: false,
        passwordHash,
        roleId: roleId('Parents'),
        userRows,
        membershipRows,
        roleAssignments,
      });
      parents.push(parentPerson);

      students.push({
        ...studentPerson,
        classId: cls.id,
        programCode: cls.programCode,
        rollNumber,
        studentProfileId: randomUUID(),
        parentProfileId: randomUUID(),
        parentRelationship: parentIsMother ? 'MOTHER' : 'FATHER',
      });
    }
  }

  console.log(
    `Inserting ${userRows.length} users, ${membershipRows.length} memberships, ${roleAssignments.length} role assignments...`,
  );
  await batchCreate(
    (chunk) => prisma.user.createMany({ data: chunk }),
    userRows,
  );
  await batchCreate(
    (chunk) => prisma.tenantMembership.createMany({ data: chunk }),
    membershipRows,
  );
  await batchCreate(
    (chunk) => prisma.membershipRole.createMany({ data: chunk }),
    roleAssignments,
  );

  // ---------- Class instructors: 1 primary + N assistants per class ----------
  console.log('Assigning class instructors (class incharge + assistants)...');
  const instructorRows: {
    id: string;
    tenantId: string;
    classId: string;
    tenantMembershipId: string;
    isPrimary: boolean;
  }[] = [];
  const teacherCount = teachers.length;
  for (let i = 0; i < classes.length; i++) {
    const cls = classes[i]!;
    const primary = teachers[i % teacherCount]!;
    instructorRows.push({
      id: randomUUID(),
      tenantId,
      classId: cls.id,
      tenantMembershipId: primary.membershipId,
      isPrimary: true,
    });
    const usedMembershipIds = new Set<string>([primary.membershipId]);
    for (let a = 1; a <= ASSISTANTS_PER_CLASS; a++) {
      const step = Math.floor((teacherCount * a) / (ASSISTANTS_PER_CLASS + 1));
      const assistant = teachers[(i + step) % teacherCount]!;
      if (usedMembershipIds.has(assistant.membershipId)) continue;
      usedMembershipIds.add(assistant.membershipId);
      instructorRows.push({
        id: randomUUID(),
        tenantId,
        classId: cls.id,
        tenantMembershipId: assistant.membershipId,
        isPrimary: false,
      });
    }
  }
  await batchCreate(
    (chunk) => prisma.classInstructor.createMany({ data: chunk }),
    instructorRows,
  );

  // Seed Class Incharge roles for primary class instructors
  const primaryMembershipIds = Array.from(
    new Set(
      instructorRows
        .filter((r) => r.isPrimary)
        .map((r) => r.tenantMembershipId),
    ),
  );
  const classInchargeRoleAssignmentRows = primaryMembershipIds.map((mId) => ({
    id: randomUUID(),
    tenantMembershipId: mId,
    roleId: roleId('Class Incharge'),
  }));
  await batchCreate(
    (chunk) => prisma.membershipRole.createMany({ data: chunk }),
    classInchargeRoleAssignmentRows,
  );

  // ---------- Parent & Student profiles + StudentParent + Enrolments ----------
  console.log('Inserting parent profiles, student profiles, and enrolments...');
  const parentProfileRows: {
    id: string;
    tenantId: string;
    tenantMembershipId: string;
    emergencyPhone: string;
  }[] = [];
  const studentProfileRows: {
    id: string;
    tenantId: string;
    tenantMembershipId: string;
    rollNumber: string;
    admissionDate: Date;
    status: string;
  }[] = [];
  const studentParentRows: {
    studentProfileId: string;
    parentProfileId: string;
    relationship: string;
  }[] = [];
  const enrolmentRows: {
    id: string;
    tenantId: string;
    studentProfileId: string;
    classId: string;
    status: string;
    enrolledAt: Date;
  }[] = [];

  for (let i = 0; i < students.length; i++) {
    const s = students[i]!;
    const parent = parents[i]!;
    parentProfileRows.push({
      id: s.parentProfileId,
      tenantId,
      tenantMembershipId: parent.membershipId,
      emergencyPhone: makePhone(430000 + i),
    });
    studentProfileRows.push({
      id: s.studentProfileId,
      tenantId,
      tenantMembershipId: s.membershipId,
      rollNumber: s.rollNumber,
      admissionDate: TERM_START,
      status: 'ACTIVE',
    });
    studentParentRows.push({
      studentProfileId: s.studentProfileId,
      parentProfileId: s.parentProfileId,
      relationship: s.parentRelationship,
    });
    enrolmentRows.push({
      id: randomUUID(),
      tenantId,
      studentProfileId: s.studentProfileId,
      classId: s.classId,
      status: 'ACTIVE',
      enrolledAt: new Date(),
    });
  }

  await batchCreate(
    (chunk) => prisma.parentProfile.createMany({ data: chunk }),
    parentProfileRows,
  );
  await batchCreate(
    (chunk) => prisma.studentProfile.createMany({ data: chunk }),
    studentProfileRows,
  );
  await batchCreate(
    (chunk) => prisma.studentParent.createMany({ data: chunk }),
    studentParentRows,
  );
  await batchCreate(
    (chunk) => prisma.enrolment.createMany({ data: chunk }),
    enrolmentRows,
  );

  await seedNoticesAndAnnouncements(prisma);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `Done in ${elapsed}s. Seeded: ${classes.length} classes, ${teachers.length} teachers, ${students.length} students, ${parents.length} parents, ${instructorRows.length} instructor assignments, ${enrolmentRows.length} enrolments.`,
  );
  console.log(`All accounts use password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
