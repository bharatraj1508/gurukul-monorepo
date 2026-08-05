import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'nestjs-prisma';

import { MoveSlotDto, SwapSlotsDto } from './dto';
import {
  PERIOD_SLOT_KIND,
  SLOT_CONFLICT_CODE,
  SlotConflictCode,
  TIMETABLE_STATUS,
} from './timetables.constants';

interface SlotConflict {
  code: SlotConflictCode;
  message: string;
  conflictingSlot?: {
    id: string;
    classId: string;
    className: string;
    courseName: string;
    dayOfWeek: number;
    periodNumber: number;
  };
}

interface ConflictProbe {
  timetableId: string;
  excludeSlotIds: string[];
  classId: string;
  teacherMembershipId: string | null;
  roomId: string | null;
  dayOfWeek: number;
  periodNumber: number;
}

const CONFLICT_INCLUDE = {
  class: { select: { id: true, name: true } },
  course: { select: { id: true, name: true } },
} as const;

const SLOT_INCLUDE = {
  ...CONFLICT_INCLUDE,
  teacher: {
    select: { id: true, user: { select: { firstName: true, lastName: true } } },
  },
  room: { select: { id: true, name: true, type: true } },
} as const;

/**
 * Drag-and-drop editing of DRAFT timetables. Collisions are checked inside the
 * mutating transaction and reported as structured 409 bodies
 * ({ conflicts: [{ code, message, conflictingSlot? }] }); the composite DB
 * uniques on TimetableSlot remain the last line of defense against races
 * (P2002 → 409).
 */
@Injectable()
export class TimetableEditorService {
  constructor(private readonly prisma: PrismaService) {}

  async moveSlot(
    tenantId: string,
    timetableId: string,
    slotId: string,
    dto: MoveSlotDto,
  ) {
    const timetable = await this.getEditableTimetable(tenantId, timetableId);
    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id: slotId, timetableId },
    });
    if (!slot) {
      throw new NotFoundException(
        `Slot ${slotId} not found in this timetable.`,
      );
    }

    this.assertValidCell(timetable, dto.dayOfWeek, dto.periodNumber);
    const targetRoomId = dto.roomId === undefined ? slot.roomId : dto.roomId;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const conflicts = await this.collectConflicts(tx, {
          timetableId,
          excludeSlotIds: [slot.id],
          classId: slot.classId,
          teacherMembershipId: slot.teacherMembershipId,
          roomId: targetRoomId,
          dayOfWeek: dto.dayOfWeek,
          periodNumber: dto.periodNumber,
        });
        if (conflicts.length > 0) {
          throw new ConflictException({
            message: 'The move collides with existing lessons.',
            conflicts,
          });
        }

        return tx.timetableSlot.update({
          where: { id: slot.id },
          data: {
            dayOfWeek: dto.dayOfWeek,
            periodNumber: dto.periodNumber,
            roomId: targetRoomId,
          },
          include: SLOT_INCLUDE,
        });
      });
    } catch (err) {
      this.mapUniqueViolation(err);
    }
  }

  async swapSlots(tenantId: string, timetableId: string, dto: SwapSlotsDto) {
    if (dto.slotAId === dto.slotBId) {
      throw new BadRequestException('Cannot swap a slot with itself.');
    }

    await this.getEditableTimetable(tenantId, timetableId);

    const slots = await this.prisma.timetableSlot.findMany({
      where: { id: { in: [dto.slotAId, dto.slotBId] }, timetableId },
    });
    const slotA = slots.find((s) => s.id === dto.slotAId);
    const slotB = slots.find((s) => s.id === dto.slotBId);
    if (!slotA || !slotB) {
      throw new NotFoundException(
        'One or both slots were not found in this timetable.',
      );
    }

    const excludeSlotIds = [slotA.id, slotB.id];

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Each slot is probed at the other's position; both target cells are
        // grid-valid by construction (both slots already sit in the grid).
        const conflicts = [
          ...(await this.collectConflicts(tx, {
            timetableId,
            excludeSlotIds,
            classId: slotA.classId,
            teacherMembershipId: slotA.teacherMembershipId,
            roomId: slotA.roomId,
            dayOfWeek: slotB.dayOfWeek,
            periodNumber: slotB.periodNumber,
          })),
          ...(await this.collectConflicts(tx, {
            timetableId,
            excludeSlotIds,
            classId: slotB.classId,
            teacherMembershipId: slotB.teacherMembershipId,
            roomId: slotB.roomId,
            dayOfWeek: slotA.dayOfWeek,
            periodNumber: slotA.periodNumber,
          })),
        ];
        if (conflicts.length > 0) {
          throw new ConflictException({
            message: 'The swap collides with existing lessons.',
            conflicts,
          });
        }

        // Delete both then recreate at swapped positions — updating in place
        // would trip the composite uniques transiently.
        await tx.timetableSlot.deleteMany({
          where: { id: { in: excludeSlotIds } },
        });
        await tx.timetableSlot.createMany({
          data: [
            {
              id: slotA.id,
              tenantId: slotA.tenantId,
              timetableId,
              classId: slotA.classId,
              courseId: slotA.courseId,
              teacherMembershipId: slotA.teacherMembershipId,
              roomId: slotA.roomId,
              dayOfWeek: slotB.dayOfWeek,
              periodNumber: slotB.periodNumber,
            },
            {
              id: slotB.id,
              tenantId: slotB.tenantId,
              timetableId,
              classId: slotB.classId,
              courseId: slotB.courseId,
              teacherMembershipId: slotB.teacherMembershipId,
              roomId: slotB.roomId,
              dayOfWeek: slotA.dayOfWeek,
              periodNumber: slotA.periodNumber,
            },
          ],
        });

        return tx.timetableSlot.findMany({
          where: { id: { in: excludeSlotIds } },
          include: SLOT_INCLUDE,
          orderBy: [{ dayOfWeek: 'asc' }, { periodNumber: 'asc' }],
        });
      });
    } catch (err) {
      this.mapUniqueViolation(err);
    }
  }

  async deleteSlot(tenantId: string, timetableId: string, slotId: string) {
    await this.getEditableTimetable(tenantId, timetableId);

    const slot = await this.prisma.timetableSlot.findFirst({
      where: { id: slotId, timetableId },
      select: { id: true },
    });
    if (!slot) {
      throw new NotFoundException(
        `Slot ${slotId} not found in this timetable.`,
      );
    }

    await this.prisma.timetableSlot.delete({ where: { id: slot.id } });
    return { message: 'Slot removed.' };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getEditableTimetable(tenantId: string, timetableId: string) {
    const timetable = await this.prisma.timetable.findFirst({
      where: { id: timetableId, tenantId, deletedAt: null },
      include: { periodTemplate: { include: { slots: true } } },
    });
    if (!timetable) {
      throw new NotFoundException(`Timetable ${timetableId} not found.`);
    }
    if (timetable.status !== TIMETABLE_STATUS.DRAFT) {
      throw new ConflictException(
        `Only draft timetables can be edited (current status: ${timetable.status}).`,
      );
    }
    return timetable;
  }

  private assertValidCell(
    timetable: {
      periodTemplate: {
        workingDays: number[];
        slots: { kind: string; periodNumber: number | null }[];
      };
    },
    dayOfWeek: number,
    periodNumber: number,
  ) {
    const validDay = timetable.periodTemplate.workingDays.includes(dayOfWeek);
    const validPeriod = timetable.periodTemplate.slots.some(
      (s) =>
        s.kind === PERIOD_SLOT_KIND.PERIOD && s.periodNumber === periodNumber,
    );
    if (!validDay || !validPeriod) {
      throw new ConflictException({
        message: 'The target cell is outside the timetable grid.',
        conflicts: [
          {
            code: SLOT_CONFLICT_CODE.INVALID_PERIOD,
            message: `Day ${dayOfWeek}, period ${periodNumber} is not part of this timetable's grid.`,
          },
        ],
      });
    }
  }

  private async collectConflicts(
    tx: Pick<PrismaService, 'timetableSlot' | 'teacherConstraint'>,
    probe: ConflictProbe,
  ): Promise<SlotConflict[]> {
    const conflicts: SlotConflict[] = [];
    const atCell = {
      timetableId: probe.timetableId,
      dayOfWeek: probe.dayOfWeek,
      periodNumber: probe.periodNumber,
      id: { notIn: probe.excludeSlotIds },
    };

    const classClash = await tx.timetableSlot.findFirst({
      where: { ...atCell, classId: probe.classId },
      include: CONFLICT_INCLUDE,
    });
    if (classClash) {
      conflicts.push({
        code: SLOT_CONFLICT_CODE.CLASS_BUSY,
        message: `${classClash.class.name} already has ${classClash.course.name} in that period.`,
        conflictingSlot: this.toConflictRef(classClash),
      });
    }

    if (probe.teacherMembershipId) {
      const teacherClash = await tx.timetableSlot.findFirst({
        where: { ...atCell, teacherMembershipId: probe.teacherMembershipId },
        include: CONFLICT_INCLUDE,
      });
      if (teacherClash) {
        conflicts.push({
          code: SLOT_CONFLICT_CODE.TEACHER_BUSY,
          message: `The teacher already teaches ${teacherClash.class.name} in that period.`,
          conflictingSlot: this.toConflictRef(teacherClash),
        });
      }

      const constraint = await tx.teacherConstraint.findFirst({
        where: {
          tenantMembershipId: probe.teacherMembershipId,
          deletedAt: null,
        },
        select: { availability: true },
      });
      const availability = constraint?.availability as
        | Record<string, number[]>
        | null
        | undefined;
      const allowed = availability?.[String(probe.dayOfWeek)];
      if (allowed && !allowed.includes(probe.periodNumber)) {
        conflicts.push({
          code: SLOT_CONFLICT_CODE.TEACHER_UNAVAILABLE,
          message: 'The teacher is not available in that period.',
        });
      }
    }

    if (probe.roomId) {
      const roomClash = await tx.timetableSlot.findFirst({
        where: { ...atCell, roomId: probe.roomId },
        include: CONFLICT_INCLUDE,
      });
      if (roomClash) {
        conflicts.push({
          code: SLOT_CONFLICT_CODE.ROOM_BUSY,
          message: `The room is already occupied by ${roomClash.class.name} in that period.`,
          conflictingSlot: this.toConflictRef(roomClash),
        });
      }
    }

    return conflicts;
  }

  private toConflictRef(slot: {
    id: string;
    classId: string;
    dayOfWeek: number;
    periodNumber: number;
    class: { name: string };
    course: { name: string };
  }) {
    return {
      id: slot.id,
      classId: slot.classId,
      className: slot.class.name,
      courseName: slot.course.name,
      dayOfWeek: slot.dayOfWeek,
      periodNumber: slot.periodNumber,
    };
  }

  /** A raced P2002 on one of the composite uniques becomes a structured 409. */
  private mapUniqueViolation(err: unknown): never {
    if (err instanceof ConflictException) throw err;

    if ((err as { code?: string })?.code === 'P2002') {
      const target = String(
        (err as { meta?: { target?: unknown } }).meta?.target ?? '',
      );
      const code = target.includes('teacher')
        ? SLOT_CONFLICT_CODE.TEACHER_BUSY
        : target.includes('room')
          ? SLOT_CONFLICT_CODE.ROOM_BUSY
          : SLOT_CONFLICT_CODE.CLASS_BUSY;
      throw new ConflictException({
        message:
          'A concurrent edit occupied the target cell. Reload and retry.',
        conflicts: [
          {
            code,
            message: 'Another edit occupied the target cell. Reload and retry.',
          },
        ],
      });
    }

    throw err;
  }
}
