import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

// Realistic syllabus topics per subject slug
const TOPICS_BY_SLUG: Record<string, { title: string; subs: string[] }[]> = {
  MATH: [
    { title: 'Number Systems', subs: ['Natural Numbers', 'Integers', 'Rational Numbers', 'Irrational Numbers'] },
    { title: 'Algebra', subs: ['Linear Equations', 'Quadratic Equations', 'Polynomials', 'Factorisation'] },
    { title: 'Geometry', subs: ['Lines & Angles', 'Triangles', 'Circles', 'Constructions'] },
    { title: 'Mensuration', subs: ['Perimeter & Area', 'Surface Area', 'Volumes'] },
    { title: 'Statistics & Probability', subs: ['Mean, Median, Mode', 'Data Representation', 'Probability Basics'] },
    { title: 'Trigonometry', subs: ['Trigonometric Ratios', 'Identities', 'Heights & Distances'] },
    { title: 'Coordinate Geometry', subs: ['Cartesian Plane', 'Distance Formula', 'Section Formula'] },
  ],
  SCI: [
    { title: 'Matter in Our Surroundings', subs: ['States of Matter', 'Evaporation', 'Sublimation'] },
    { title: 'Motion & Force', subs: ['Speed & Velocity', 'Acceleration', "Newton's Laws"] },
    { title: 'Cell: Structure & Function', subs: ['Cell Theory', 'Organelles', 'Prokaryotes vs Eukaryotes'] },
    { title: 'Atoms & Molecules', subs: ['Law of Conservation', 'Atomic Mass', 'Mole Concept'] },
    { title: 'Sound', subs: ['Propagation', 'Reflection of Sound', 'Range of Hearing'] },
    { title: 'Life Processes', subs: ['Nutrition', 'Respiration', 'Transportation', 'Excretion'] },
    { title: 'Heredity & Evolution', subs: ['Mendel\'s Laws', 'Sex Determination', 'Evolution'] },
  ],
  ENG: [
    { title: 'Reading Comprehension', subs: ['Unseen Passages', 'Note-Making', 'Summarisation'] },
    { title: 'Grammar', subs: ['Tenses', 'Voice & Narration', 'Modals', 'Prepositions'] },
    { title: 'Writing Skills', subs: ['Letter Writing', 'Article & Story', 'Speech Writing'] },
    { title: 'Literature: Prose', subs: ['Chapter 1 Analysis', 'Character Study', 'Themes'] },
    { title: 'Literature: Poetry', subs: ['Poem Analysis', 'Figures of Speech', 'Central Idea'] },
    { title: 'Language & Communication', subs: ['Vocabulary Building', 'Idioms & Phrases'] },
  ],
  SST: [
    { title: 'History: The French Revolution', subs: ['Causes', 'Events', 'Aftermath'] },
    { title: 'Geography: Resources', subs: ['Natural Resources', 'Land Resources', 'Water Resources'] },
    { title: 'Civics: Democracy', subs: ['What is Democracy?', 'Electoral Politics', 'Working of Institutions'] },
    { title: 'Economics: Development', subs: ['Development Goals', 'Money & Credit', 'Globalisation'] },
    { title: 'History: World Wars', subs: ['World War I Causes', 'World War II', 'Cold War'] },
    { title: 'Map Skills', subs: ['Physical Maps', 'Political Maps', 'Thematic Maps'] },
  ],
  PHY: [
    { title: 'Physical World & Measurement', subs: ['Scope of Physics', 'Units', 'Significant Figures'] },
    { title: 'Kinematics', subs: ['Motion in a Straight Line', 'Motion in a Plane', 'Projectile Motion'] },
    { title: 'Laws of Motion', subs: ['First Law', 'Second Law', 'Third Law', 'Friction'] },
    { title: 'Work, Energy & Power', subs: ['Work Done', 'Kinetic Energy', 'Conservation of Energy'] },
    { title: 'Gravitation', subs: ["Kepler's Laws", "Universal Law", "Satellites"] },
    { title: 'Thermodynamics', subs: ['Thermal Equilibrium', 'Laws of Thermodynamics', 'Heat Engines'] },
    { title: 'Electrostatics', subs: ["Coulomb's Law", 'Electric Field', 'Capacitance'] },
    { title: 'Current Electricity', subs: ["Ohm's Law", 'Kirchhoff\'s Laws', 'Cells & Batteries'] },
  ],
  CHE: [
    { title: 'Some Basic Concepts of Chemistry', subs: ['Laws of Chemical Combination', 'Mole Concept', 'Stoichiometry'] },
    { title: 'Structure of Atom', subs: ["Bohr's Model", 'Quantum Numbers', 'Electronic Configuration'] },
    { title: 'Chemical Bonding', subs: ['Ionic Bonds', 'Covalent Bonds', 'VSEPR Theory'] },
    { title: 'Thermochemistry', subs: ['Enthalpy', 'Hess\'s Law', 'Entropy'] },
    { title: 'Equilibrium', subs: ["Le Chatelier's Principle", 'Ionic Equilibrium', 'pH'] },
    { title: 'Organic Chemistry: Basics', subs: ['Hybridisation', 'Isomerism', 'Reaction Mechanisms'] },
  ],
  CS: [
    { title: 'Introduction to Computers', subs: ['Hardware vs Software', 'Types of Computers', 'OS Basics'] },
    { title: 'Programming Basics', subs: ['Algorithms & Flowcharts', 'Variables & Data Types', 'Control Structures'] },
    { title: 'Data Structures', subs: ['Arrays', 'Stacks & Queues', 'Linked Lists', 'Trees'] },
    { title: 'Database Management', subs: ['DBMS Concepts', 'SQL Queries', 'ER Diagrams'] },
    { title: 'Networking', subs: ['Network Types', 'Protocols', 'Internet & Web'] },
    { title: 'Cybersecurity', subs: ['Threats & Vulnerabilities', 'Encryption', 'Safe Practices'] },
  ],
};

const METHODOLOGY_OPTIONS = [
  'Lecture',
  'Lab',
  'Group Activity',
  'Presentation',
  'Discussion',
  'Demonstration',
] as const;

type MethodologyType = typeof METHODOLOGY_OPTIONS[number];

function pickMethodology(idx: number): MethodologyType {
  return METHODOLOGY_OPTIONS[idx % METHODOLOGY_OPTIONS.length]!;
}

export async function seedLessonPlans(
  prisma: PrismaClient,
  tenantId: string,
  academicTermId: string,
  teachers: { membershipId: string; firstName: string; lastName: string }[],
  classes: { id: string; programCode: string; sectionName: string }[],
): Promise<void> {
  console.log('Seeding syllabus topics...');

  // Fetch all courses for this tenant
  const courses = await prisma.course.findMany({
    where: { tenantId },
    select: { id: true, code: true, name: true },
  });

  // Build a map: code-suffix → ALL courseIds  (e.g. 'MATH' → [id1, id2, ...])
  const coursesBySlug = new Map<string, Array<{ id: string; code: string }>>();
  for (const course of courses) {
    // code format: PRG-G10-MATH → slug = MATH
    const parts = course.code.split('-');
    const slug = parts[parts.length - 1];
    if (slug) {
      if (!coursesBySlug.has(slug)) coursesBySlug.set(slug, []);
      coursesBySlug.get(slug)!.push(course);
    }
  }

  // Seed syllabus topics for ALL courses that match each slug
  // topicIdsByCourseId stores courseId → flat list of top-level topic IDs (for lesson plan creation)
  const topicIdsByCourseId = new Map<string, string[]>();
  // Keep a slug-level reference for lesson plan seeding (uses first course per slug)
  const topicIdByCourseSlug = new Map<string, string[]>();

  for (const [slug, topicDefs] of Object.entries(TOPICS_BY_SLUG)) {
    const matchingCourses = coursesBySlug.get(slug);
    if (!matchingCourses || matchingCourses.length === 0) continue;

    for (const course of matchingCourses) {
      const topicIds: string[] = [];
      for (let ti = 0; ti < topicDefs.length; ti++) {
        const def = topicDefs[ti]!;
        const parentTopic = await prisma.syllabusTopic.create({
          data: {
            tenantId,
            courseId: course.id,
            title: def.title,
            orderIndex: ti,
          },
        });
        topicIds.push(parentTopic.id);

        // Create sub-topics
        for (let si = 0; si < def.subs.length; si++) {
          await prisma.syllabusTopic.create({
            data: {
              tenantId,
              courseId: course.id,
              parentId: parentTopic.id,
              title: def.subs[si]!,
              orderIndex: si,
            },
          });
        }
      }
      topicIdsByCourseId.set(course.id, topicIds);
    }

    // Use first course's topics for backward-compatible lesson plan seeding
    const firstCourse = matchingCourses[0]!;
    const firstTopicIds = topicIdsByCourseId.get(firstCourse.id);
    if (firstTopicIds) topicIdByCourseSlug.set(slug, firstTopicIds);
  }

  console.log('Seeding lesson plans (Draft, Submitted, Approved, Revision Requested)...');

  // Only seed lesson plans for classes from SECONDARY/SENIOR_SECONDARY and first few named teachers
  const targetClasses = classes.filter((c) =>
    ['PRG-G09', 'PRG-G10', 'PRG-G11', 'PRG-G12'].includes(c.programCode),
  ).slice(0, 12); // limit to 12 classes for reasonable seed size

  const targetSlugs = ['MATH', 'SCI', 'ENG', 'SST', 'PHY', 'CHE', 'CS'];
  const statuses: Array<'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REVISION_REQUESTED'> = [
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'REVISION_REQUESTED',
  ];

  let planCount = 0;
  let teacherIdx = 0;

  for (let classIdx = 0; classIdx < targetClasses.length; classIdx++) {
    const cls = targetClasses[classIdx]!;

    for (let slugIdx = 0; slugIdx < targetSlugs.length; slugIdx++) {
      const slug = targetSlugs[slugIdx]!;
      const slugCourses = coursesBySlug.get(slug);
      if (!slugCourses || slugCourses.length === 0) continue;

      // Pick the course matching this class's program (e.g. PRG-G10-MATH for PRG-G10 class)
      const matchingCourse = slugCourses.find((c) => c.code.startsWith(cls.programCode + '-'));
      const courseId = matchingCourse?.id ?? slugCourses[0]!.id;

      // Use course-specific topics if available, otherwise fall back to slug-level
      const topicIds = topicIdsByCourseId.get(courseId) ?? topicIdByCourseSlug.get(slug);
      if (!topicIds || topicIds.length === 0) continue;

      const teacher = teachers[teacherIdx % teachers.length]!;
      teacherIdx++;

      const status = statuses[(classIdx + slugIdx) % statuses.length]!;
      const weekNumber = (classIdx % 8) + 1;
      const startDate = new Date(2026, 6, 7 + (weekNumber - 1) * 7);
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 4);

      const plan = await prisma.lessonPlan.create({
        data: {
          tenantId,
          classId: cls.id,
          courseId,
          academicTermId,
          createdById: teacher.membershipId,
          planType: 'WEEKLY',
          weekNumber,
          year: 2026,
          startDate,
          endDate,
          status,
          version: 1,
          submittedAt: status !== 'DRAFT' ? new Date('2026-07-28') : null,
          approvedAt: status === 'APPROVED' ? new Date('2026-07-29') : null,
          generalRemarks:
            status === 'REVISION_REQUESTED'
              ? 'Please add more detail on learning outcomes for topics 2 and 3, and clarify the methodology for lab sessions.'
              : status === 'APPROVED'
              ? 'Well structured plan. Good coverage of the syllabus.'
              : null,
        },
      });

      // Add 3–4 topic items per plan
      const numItems = Math.min(topicIds.length, 3 + (planCount % 2));
      for (let itemIdx = 0; itemIdx < numItems; itemIdx++) {
        const topicId = topicIds[(itemIdx + classIdx) % topicIds.length]!;
        await prisma.lessonPlanItem.create({
          data: {
            lessonPlanId: plan.id,
            syllabusTopicId: topicId,
            estimatedHours: 1 + (itemIdx % 3) + 0.5,
            methodology: pickMethodology(classIdx + itemIdx),
            resources:
              itemIdx === 0
                ? `Textbook Chapter ${weekNumber + itemIdx}, NCERT ${slug} Grade ${cls.programCode.replace('PRG-G', '')}`
                : itemIdx === 1
                ? 'Worksheets, Past year papers'
                : 'Lab kit, Digital board, YouTube reference video',
            learningOutcomes:
              `Students will be able to understand and apply concepts related to the topic. ` +
              `They will solve problems independently and demonstrate understanding through class participation.`,
            hodComment:
              status === 'REVISION_REQUESTED' && itemIdx === 1
                ? 'Please elaborate on the teaching methodology and add specific resource references.'
                : null,
            orderIndex: itemIdx,
          },
        });
      }

      planCount++;
    }
  }

  console.log(`Seeded ${planCount} lesson plans across ${targetClasses.length} classes.`);
}
