import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'nestjs-prisma';

import { PERIOD_SLOT_KIND, TIMETABLE_STATUS } from './timetables.constants';
import {
  addDaysIso,
  isoWeekday,
  parseIsoDate,
  toIsoDate,
} from './timetables.util';

const VIEW_SLOT_INCLUDE = {
  class: { select: { id: true, name: true } },
  course: { select: { id: true, name: true } },
  teacher: {
    select: { id: true, user: { select: { firstName: true, lastName: true } } },
  },
  room: { select: { id: true, name: true, type: true } },
} as const;

type ViewSlot = {
  id: string;
  classId: string;
  dayOfWeek: number;
  periodNumber: number;
  class: { id: string; name: string };
  course: { id: string; name: string };
  teacher: {
    id: string;
    user: { firstName: string; lastName: string };
  } | null;
  room: { id: string; name: string; type: string } | null;
};

type ViewSubstitution = {
  timetableSlotId: string;
  date: Date;
  reason: string | null;
  substitute: { id: string; user: { firstName: string; lastName: string } };
};

type TimetableWithTemplate = {
  id: string;
  name: string;
  publishedAt: Date | null;
  periodTemplate: {
    workingDays: number[];
    slots: {
      sortOrder: number;
      kind: string;
      label: string | null;
      startTime: string;
      endTime: string;
      periodNumber: number | null;
    }[];
  };
};

export interface ViewEntry {
  slotId: string;
  periodNumber: number;
  class: { id: string; name: string };
  course: { id: string; name: string };
  teacher: { membershipId: string; name: string } | null;
  room: { id: string; name: string; type: string } | null;
  substitution?: { teacherName: string; reason: string | null };
  substitutedOut?: boolean;
  substituteIn?: boolean;
}

/**
 * Read-side of the timetable feature: `/timetable/*` endpoints for students,
 * parents, teachers, and admins. All views share one response shape — the
 * period template (with BREAK/LUNCH/ASSEMBLY rows) merged with the published
 * slots, plus substitutions for the client-supplied week.
 */
@Injectable()
export class TimetableViewerService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Viewer context (persona detection — /users/me has no discriminator)
  // ---------------------------------------------------------------------------

  async getViewerContext(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!membership) {
      return {
        personas: { isStudent: false, isTeacher: false, isParent: false },
        children: [],
      };
    }

    const [studentProfile, instructorCount, parentProfile] = await Promise.all([
      this.prisma.studentProfile.findFirst({
        where: { tenantId, tenantMembershipId: membership.id, deletedAt: null },
        select: { id: true },
      }),
      this.prisma.classInstructor.count({
        where: { tenantId, tenantMembershipId: membership.id, deletedAt: null },
      }),
      this.prisma.parentProfile.findFirst({
        where: { tenantId, tenantMembershipId: membership.id, deletedAt: null },
        select: { id: true },
      }),
    ]);

    let children: {
      studentProfileId: string;
      name: string;
      className: string | null;
    }[] = [];

    if (parentProfile) {
      const links = await this.prisma.studentParent.findMany({
        where: {
          parentProfileId: parentProfile.id,
          student: { tenantId, deletedAt: null },
        },
        include: {
          student: {
            include: {
              membership: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
              enrolments: {
                where: { status: 'ACTIVE', deletedAt: null },
                include: { class: { select: { name: true } } },
                orderBy: { enrolledAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      children = links.map((link) => ({
        studentProfileId: link.student.id,
        name: link.student.membership?.user
          ? `${link.student.membership.user.firstName} ${link.student.membership.user.lastName}`
          : link.student.rollNumber,
        className: link.student.enrolments[0]?.class.name ?? null,
      }));
    }

    return {
      personas: {
        isStudent: !!studentProfile,
        isTeacher: instructorCount > 0,
        isParent: !!parentProfile,
      },
      children,
    };
  }

  // ---------------------------------------------------------------------------
  // Student / parent / class views
  // ---------------------------------------------------------------------------

  async getMyTimetable(tenantId: string, userId: string, weekStart?: string) {
    this.validateWeekStart(weekStart);
    const membership = await this.getMembership(tenantId, userId);

    const student = await this.prisma.studentProfile.findFirst({
      where: { tenantId, tenantMembershipId: membership.id, deletedAt: null },
      select: { id: true },
    });
    if (!student) {
      throw new NotFoundException(
        'You do not have a student profile in this school.',
      );
    }

    return this.buildStudentView(tenantId, student.id, weekStart);
  }

  async getStudentTimetable(
    tenantId: string,
    userId: string,
    studentProfileId: string,
    weekStart?: string,
  ) {
    this.validateWeekStart(weekStart);
    const membership = await this.getMembership(tenantId, userId);

    const parent = await this.prisma.parentProfile.findFirst({
      where: { tenantId, tenantMembershipId: membership.id, deletedAt: null },
      select: { id: true },
    });
    if (!parent) {
      throw new ForbiddenException(
        'You do not have a parent profile in this school.',
      );
    }

    const link = await this.prisma.studentParent.findFirst({
      where: { parentProfileId: parent.id, studentProfileId },
      select: { studentProfileId: true },
    });
    if (!link) {
      throw new ForbiddenException(
        'You can only view timetables of your own children.',
      );
    }

    const student = await this.prisma.studentProfile.findFirst({
      where: { id: studentProfileId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!student) throw new NotFoundException('Student not found.');

    return this.buildStudentView(tenantId, studentProfileId, weekStart);
  }

  async getClassTimetable(
    tenantId: string,
    classId: string,
    weekStart?: string,
  ) {
    this.validateWeekStart(weekStart);

    const klass = await this.prisma.class.findFirst({
      where: { id: classId, tenantId, deletedAt: null },
      select: { id: true, name: true, academicTermId: true },
    });
    if (!klass) throw new NotFoundException(`Class ${classId} not found.`);

    const timetable = await this.findPublishedForTerm(
      tenantId,
      klass.academicTermId,
    );
    if (!timetable) {
      throw new NotFoundException(
        `No timetable has been published for ${klass.name} yet.`,
      );
    }

    return this.buildClassView(timetable, klass, weekStart);
  }

  // ---------------------------------------------------------------------------
  // Teacher view
  // ---------------------------------------------------------------------------

  async getMyTeacherTimetable(
    tenantId: string,
    userId: string,
    weekStart?: string,
  ) {
    this.validateWeekStart(weekStart);
    const membership = await this.getMembership(tenantId, userId);

    // The published timetable this teacher appears in (latest first); teachers
    // with no own lessons can still be substitutes in the latest published one.
    const ownSlot = await this.prisma.timetableSlot.findFirst({
      where: {
        tenantId,
        teacherMembershipId: membership.id,
        timetable: { status: TIMETABLE_STATUS.PUBLISHED, deletedAt: null },
      },
      orderBy: { timetable: { publishedAt: 'desc' } },
      select: { timetableId: true },
    });

    let timetableId = ownSlot?.timetableId;
    if (!timetableId) {
      const latest = await this.prisma.timetable.findFirst({
        where: {
          tenantId,
          status: TIMETABLE_STATUS.PUBLISHED,
          deletedAt: null,
        },
        orderBy: { publishedAt: 'desc' },
        select: { id: true },
      });
      if (!latest) {
        throw new NotFoundException('No timetable has been published yet.');
      }
      timetableId = latest.id;
    }

    const timetable = await this.getTimetableWithTemplate(
      tenantId,
      timetableId,
    );
    const mySlots = (await this.prisma.timetableSlot.findMany({
      where: { timetableId, teacherMembershipId: membership.id },
      include: VIEW_SLOT_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    })) as ViewSlot[];

    // Substitutions on my lessons (someone covers me) for the requested week…
    const subsOut = weekStart
      ? await this.fetchWeekSubstitutions(
          mySlots.map((s) => s.id),
          weekStart,
        )
      : [];
    // …and lessons of others I cover as substitute.
    const subsIn = weekStart
      ? await this.prisma.timetableSubstitution.findMany({
          where: {
            tenantId,
            deletedAt: null,
            substituteTeacherMembershipId: membership.id,
            slot: { timetableId },
            date: this.weekRange(weekStart),
          },
          include: {
            slot: { include: VIEW_SLOT_INCLUDE },
            substitute: {
              select: {
                id: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        })
      : [];

    const subOutByKey = this.substitutionMap(subsOut);

    const days = this.buildDays(timetable, weekStart, (dayOfWeek, date) => {
      const entries: ViewEntry[] = mySlots
        .filter((slot) => slot.dayOfWeek === dayOfWeek)
        .map((slot) => {
          const sub = date ? subOutByKey.get(`${slot.id}|${date}`) : undefined;
          const entry = this.toEntry(slot, sub);
          if (sub) entry.substitutedOut = true;
          return entry;
        });

      for (const sub of subsIn) {
        if (date && toIsoDate(sub.date) === date) {
          const entry = this.toEntry(sub.slot as unknown as ViewSlot);
          entry.substituteIn = true;
          entry.substitution = {
            teacherName: `${sub.substitute.user.firstName} ${sub.substitute.user.lastName}`,
            reason: sub.reason,
          };
          entries.push(entry);
        }
      }

      return entries.sort((a, b) => a.periodNumber - b.periodNumber);
    });

    return this.toResponse(timetable, days);
  }

  // ---------------------------------------------------------------------------
  // View builders
  // ---------------------------------------------------------------------------

  private async buildStudentView(
    tenantId: string,
    studentProfileId: string,
    weekStart?: string,
  ) {
    const enrolment = await this.prisma.enrolment.findFirst({
      where: {
        tenantId,
        studentProfileId,
        status: 'ACTIVE',
        deletedAt: null,
        class: { deletedAt: null },
      },
      orderBy: { enrolledAt: 'desc' },
      include: {
        class: { select: { id: true, name: true, academicTermId: true } },
      },
    });
    if (!enrolment) {
      throw new NotFoundException('No active class enrolment found.');
    }

    const timetable = await this.findPublishedForTerm(
      tenantId,
      enrolment.class.academicTermId,
    );
    if (!timetable) {
      throw new NotFoundException(
        `No timetable has been published for ${enrolment.class.name} yet.`,
      );
    }

    return this.buildClassView(timetable, enrolment.class, weekStart);
  }

  private async buildClassView(
    timetable: TimetableWithTemplate,
    klass: { id: string; name: string },
    weekStart?: string,
  ) {
    const slots = (await this.prisma.timetableSlot.findMany({
      where: { timetableId: timetable.id, classId: klass.id },
      include: VIEW_SLOT_INCLUDE,
      orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
    })) as ViewSlot[];

    const substitutions = weekStart
      ? await this.fetchWeekSubstitutions(
          slots.map((s) => s.id),
          weekStart,
        )
      : [];
    const subByKey = this.substitutionMap(substitutions);

    const days = this.buildDays(timetable, weekStart, (dayOfWeek, date) =>
      slots
        .filter((slot) => slot.dayOfWeek === dayOfWeek)
        .map((slot) =>
          this.toEntry(
            slot,
            date ? subByKey.get(`${slot.id}|${date}`) : undefined,
          ),
        ),
    );

    return {
      ...this.toResponse(timetable, days),
      class: { id: klass.id, name: klass.name },
    };
  }

  private buildDays(
    timetable: TimetableWithTemplate,
    weekStart: string | undefined,
    entriesFor: (dayOfWeek: number, date: string | null) => ViewEntry[],
  ) {
    const workingDays = [...timetable.periodTemplate.workingDays].sort(
      (a, b) => a - b,
    );
    return workingDays.map((dayOfWeek) => {
      const date = weekStart ? addDaysIso(weekStart, dayOfWeek - 1) : null;
      return { dayOfWeek, date, entries: entriesFor(dayOfWeek, date) };
    });
  }

  private toResponse(
    timetable: TimetableWithTemplate,
    days: { dayOfWeek: number; date: string | null; entries: ViewEntry[] }[],
  ) {
    return {
      timetable: {
        id: timetable.id,
        name: timetable.name,
        publishedAt: timetable.publishedAt,
      },
      periodTemplate: {
        workingDays: [...timetable.periodTemplate.workingDays].sort(
          (a, b) => a - b,
        ),
        slots: [...timetable.periodTemplate.slots]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((slot) => ({
            sortOrder: slot.sortOrder,
            kind: slot.kind,
            label: slot.label,
            startTime: slot.startTime,
            endTime: slot.endTime,
            periodNumber: slot.periodNumber,
          })),
      },
      days,
    };
  }

  private toEntry(slot: ViewSlot, substitution?: ViewSubstitution): ViewEntry {
    return {
      slotId: slot.id,
      periodNumber: slot.periodNumber,
      class: slot.class,
      course: slot.course,
      teacher: slot.teacher
        ? {
            membershipId: slot.teacher.id,
            name: `${slot.teacher.user.firstName} ${slot.teacher.user.lastName}`,
          }
        : null,
      room: slot.room,
      ...(substitution
        ? {
            substitution: {
              teacherName: `${substitution.substitute.user.firstName} ${substitution.substitute.user.lastName}`,
              reason: substitution.reason,
            },
          }
        : {}),
    };
  }

  // ---------------------------------------------------------------------------
  // Lookup helpers
  // ---------------------------------------------------------------------------

  private async getMembership(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('Tenant membership not found.');
    }
    return membership;
  }

  private findPublishedForTerm(tenantId: string, academicTermId: string) {
    return this.prisma.timetable.findFirst({
      where: {
        tenantId,
        academicTermId,
        status: TIMETABLE_STATUS.PUBLISHED,
        deletedAt: null,
      },
      include: {
        periodTemplate: {
          include: { slots: { orderBy: { sortOrder: 'asc' as const } } },
        },
      },
    }) as Promise<TimetableWithTemplate | null>;
  }

  private async getTimetableWithTemplate(tenantId: string, id: string) {
    const timetable = (await this.prisma.timetable.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        periodTemplate: {
          include: { slots: { orderBy: { sortOrder: 'asc' as const } } },
        },
      },
    })) as TimetableWithTemplate | null;
    if (!timetable) throw new NotFoundException(`Timetable ${id} not found.`);
    return timetable;
  }

  private fetchWeekSubstitutions(
    slotIds: string[],
    weekStart: string,
  ): Promise<ViewSubstitution[]> {
    if (slotIds.length === 0) return Promise.resolve([]);
    return this.prisma.timetableSubstitution.findMany({
      where: {
        timetableSlotId: { in: slotIds },
        deletedAt: null,
        date: this.weekRange(weekStart),
      },
      include: {
        substitute: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }) as unknown as Promise<ViewSubstitution[]>;
  }

  private substitutionMap(substitutions: ViewSubstitution[]) {
    return new Map(
      substitutions.map((s) => [
        `${s.timetableSlotId}|${toIsoDate(s.date)}`,
        s,
      ]),
    );
  }

  private weekRange(weekStart: string) {
    return {
      gte: parseIsoDate(weekStart),
      lte: parseIsoDate(addDaysIso(weekStart, 6)),
    };
  }

  /** weekStart is client-supplied (no server tz math) and must be a Monday. */
  private validateWeekStart(weekStart?: string) {
    if (weekStart === undefined) return;
    if (isoWeekday(weekStart) !== 1) {
      throw new BadRequestException('weekStart must be a Monday (YYYY-MM-DD).');
    }
  }
}
