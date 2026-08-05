import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'nestjs-prisma';

import { CreateSubstitutionDto, UpdateSubstitutionDto } from '../dto';
import { TIMETABLE_STATUS } from '../timetables.constants';
import { isoWeekday, parseIsoDate, toIsoDate } from '../timetables.util';

const USER_NAME_SELECT = {
  user: { select: { firstName: true, lastName: true } },
} as const;

const SUBSTITUTION_INCLUDE = {
  slot: {
    include: {
      class: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      teacher: { select: { id: true, ...USER_NAME_SELECT } },
    },
  },
  substitute: { select: { id: true, ...USER_NAME_SELECT } },
} as const;

@Injectable()
export class SubstitutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    params?: { date?: string; classId?: string },
  ) {
    const substitutions = await this.prisma.timetableSubstitution.findMany({
      where: {
        tenantId,
        deletedAt: null,
        ...(params?.date && { date: parseIsoDate(params.date) }),
        ...(params?.classId && { slot: { classId: params.classId } }),
      },
      include: SUBSTITUTION_INCLUDE,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });
    return substitutions.map((s) => this.format(s));
  }

  async create(tenantId: string, userId: string, dto: CreateSubstitutionDto) {
    const slot = await this.getPublishedSlot(tenantId, dto.timetableSlotId);
    await this.validate(
      tenantId,
      slot,
      dto.date,
      dto.substituteTeacherMembershipId,
    );

    try {
      const created = await this.prisma.timetableSubstitution.create({
        data: {
          tenantId,
          timetableSlotId: slot.id,
          date: parseIsoDate(dto.date),
          substituteTeacherMembershipId: dto.substituteTeacherMembershipId,
          reason: dto.reason ?? null,
          createdBy: userId,
        },
        include: SUBSTITUTION_INCLUDE,
      });
      return this.format(created);
    } catch (err) {
      this.rethrowDuplicate(err);
    }
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateSubstitutionDto,
  ) {
    const existing = await this.prisma.timetableSubstitution.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!existing) throw new NotFoundException(`Substitution ${id} not found.`);

    const slot = await this.getPublishedSlot(
      tenantId,
      dto.timetableSlotId ?? existing.timetableSlotId,
    );
    const date = dto.date ?? toIsoDate(existing.date);
    const substituteId =
      dto.substituteTeacherMembershipId ??
      existing.substituteTeacherMembershipId;

    await this.validate(tenantId, slot, date, substituteId, existing.id);

    try {
      const updated = await this.prisma.timetableSubstitution.update({
        where: { id: existing.id },
        data: {
          timetableSlotId: slot.id,
          date: parseIsoDate(date),
          substituteTeacherMembershipId: substituteId,
          ...(dto.reason !== undefined && { reason: dto.reason }),
          updatedBy: userId,
        },
        include: SUBSTITUTION_INCLUDE,
      });
      return this.format(updated);
    } catch (err) {
      this.rethrowDuplicate(err);
    }
  }

  async remove(tenantId: string, id: string, userId: string) {
    const existing = await this.prisma.timetableSubstitution.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException(`Substitution ${id} not found.`);

    await this.prisma.timetableSubstitution.update({
      where: { id: existing.id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    return { message: 'Substitution removed.' };
  }

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  private async getPublishedSlot(tenantId: string, timetableSlotId: string) {
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id: timetableSlotId, tenantId },
      include: {
        timetable: { select: { id: true, status: true, deletedAt: true } },
      },
    });
    if (!slot || slot.timetable.deletedAt) {
      throw new NotFoundException(`Slot ${timetableSlotId} not found.`);
    }
    if (slot.timetable.status !== TIMETABLE_STATUS.PUBLISHED) {
      throw new BadRequestException(
        'Substitutions can only be scheduled on the published timetable.',
      );
    }
    return slot;
  }

  private async validate(
    tenantId: string,
    slot: {
      id: string;
      timetableId: string;
      dayOfWeek: number;
      periodNumber: number;
      teacherMembershipId: string | null;
    },
    date: string,
    substituteId: string,
    excludeSubstitutionId?: string,
  ) {
    if (isoWeekday(date) !== slot.dayOfWeek) {
      throw new BadRequestException(
        `${date} does not fall on this lesson's weekday.`,
      );
    }

    const substitute = await this.prisma.tenantMembership.findFirst({
      where: { id: substituteId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!substitute) {
      throw new NotFoundException(
        'Substitute teacher not found in this school.',
      );
    }
    if (substituteId === slot.teacherMembershipId) {
      throw new BadRequestException(
        'The substitute is already the teacher of this lesson.',
      );
    }

    // Busy check 1: the substitute teaches their own lesson in that period.
    const teaching = await this.prisma.timetableSlot.findFirst({
      where: {
        timetableId: slot.timetableId,
        teacherMembershipId: substituteId,
        dayOfWeek: slot.dayOfWeek,
        periodNumber: slot.periodNumber,
      },
      select: { id: true },
    });
    if (teaching) {
      throw new ConflictException(
        'The substitute already teaches another lesson in that period.',
      );
    }

    // Busy check 2: the substitute already covers another lesson at the same
    // date + period.
    const covering = await this.prisma.timetableSubstitution.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        substituteTeacherMembershipId: substituteId,
        date: parseIsoDate(date),
        slot: { periodNumber: slot.periodNumber },
        ...(excludeSubstitutionId
          ? { id: { not: excludeSubstitutionId } }
          : {}),
      },
      select: { id: true },
    });
    if (covering) {
      throw new ConflictException(
        'The substitute is already covering another lesson at that date and period.',
      );
    }
  }

  private rethrowDuplicate(err: unknown): never {
    if ((err as { code?: string })?.code === 'P2002') {
      throw new ConflictException(
        'A substitution for this lesson and date already exists.',
      );
    }
    throw err;
  }

  private format(s: {
    id: string;
    timetableSlotId: string;
    date: Date;
    reason: string | null;
    createdAt: Date;
    updatedAt: Date;
    slot: {
      classId: string;
      dayOfWeek: number;
      periodNumber: number;
      class: { id: string; name: string };
      course: { id: string; name: string };
      teacher: {
        id: string;
        user: { firstName: string; lastName: string };
      } | null;
    };
    substitute: { id: string; user: { firstName: string; lastName: string } };
  }) {
    return {
      id: s.id,
      timetableSlotId: s.timetableSlotId,
      date: toIsoDate(s.date),
      reason: s.reason,
      class: s.slot.class,
      course: s.slot.course,
      dayOfWeek: s.slot.dayOfWeek,
      periodNumber: s.slot.periodNumber,
      originalTeacher: s.slot.teacher
        ? {
            membershipId: s.slot.teacher.id,
            name: `${s.slot.teacher.user.firstName} ${s.slot.teacher.user.lastName}`,
          }
        : null,
      substitute: {
        membershipId: s.substitute.id,
        name: `${s.substitute.user.firstName} ${s.substitute.user.lastName}`,
      },
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
}
