import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'nestjs-prisma';

import {
  CreatePeriodTemplateDto,
  PeriodTemplateSlotDto,
  UpdatePeriodTemplateDto,
} from '../dto';
import { PERIOD_SLOT_KIND, TIMETABLE_STATUS } from '../timetables.constants';
import { hhmmToMinutes } from '../timetables.util';

const TEMPLATE_INCLUDE = {
  slots: { orderBy: { sortOrder: 'asc' as const } },
} as const;

@Injectable()
export class PeriodTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreatePeriodTemplateDto) {
    this.validateSlots(dto.slots);
    await this.assertNameAvailable(tenantId, dto.name);

    try {
      return await this.prisma.periodTemplate.create({
        data: {
          tenantId,
          name: dto.name.trim(),
          workingDays: [...dto.workingDays].sort((a, b) => a - b),
          createdBy: userId,
          slots: { create: this.toSlotRows(dto.slots) },
        },
        include: TEMPLATE_INCLUDE,
      });
    } catch (err) {
      this.rethrowDuplicateName(err, dto.name);
    }
  }

  async findAll(tenantId: string) {
    return this.prisma.periodTemplate.findMany({
      where: { tenantId, deletedAt: null },
      include: TEMPLATE_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.periodTemplate.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: TEMPLATE_INCLUDE,
    });
    if (!template)
      throw new NotFoundException(`Period template ${id} not found.`);
    return template;
  }

  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdatePeriodTemplateDto,
  ) {
    const template = await this.findOne(tenantId, id);

    if (dto.slots !== undefined) this.validateSlots(dto.slots);
    if (dto.name !== undefined && dto.name.trim() !== template.name) {
      await this.assertNameAvailable(tenantId, dto.name, id);
    }

    // Structural edits (period count/numbers or working days) would silently
    // invalidate slots of live timetables built on this grid — block them.
    if (this.isStructuralChange(template, dto)) {
      const referencedBy = await this.countLiveReferences(tenantId, id);
      if (referencedBy > 0) {
        throw new ConflictException(
          'This template is used by an active timetable. Archive or delete those versions before changing its periods or working days.',
        );
      }
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.slots !== undefined) {
          await tx.periodTemplateSlot.deleteMany({
            where: { periodTemplateId: id },
          });
          await tx.periodTemplateSlot.createMany({
            data: this.toSlotRows(dto.slots).map((slot) => ({
              ...slot,
              periodTemplateId: id,
            })),
          });
        }

        return tx.periodTemplate.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name.trim() }),
            ...(dto.workingDays !== undefined && {
              workingDays: [...dto.workingDays].sort((a, b) => a - b),
            }),
            updatedBy: userId,
          },
          include: TEMPLATE_INCLUDE,
        });
      });
    } catch (err) {
      this.rethrowDuplicateName(err, dto.name ?? template.name);
    }
  }

  async remove(tenantId: string, id: string, userId: string) {
    await this.findOne(tenantId, id);

    const referencedBy = await this.countLiveReferences(tenantId, id);
    if (referencedBy > 0) {
      throw new ConflictException(
        'This template is used by an active timetable and cannot be deleted.',
      );
    }

    await this.prisma.periodTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    return { message: 'Period template deleted successfully.' };
  }

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  /**
   * Enforces: start < end per slot, chronological non-overlap across the day,
   * periodNumber present exactly on PERIOD slots, and PERIOD numbers contiguous
   * from 1 in order of appearance.
   */
  private validateSlots(slots: PeriodTemplateSlotDto[]) {
    if (!slots.some((s) => s.kind === PERIOD_SLOT_KIND.PERIOD)) {
      throw new BadRequestException(
        'A template needs at least one PERIOD slot.',
      );
    }

    let expectedPeriod = 1;
    slots.forEach((slot, i) => {
      const start = hhmmToMinutes(slot.startTime);
      const end = hhmmToMinutes(slot.endTime);
      if (start >= end) {
        throw new BadRequestException(
          `Slot ${i + 1}: startTime must be before endTime.`,
        );
      }
      if (i > 0 && hhmmToMinutes(slots[i - 1].endTime) > start) {
        throw new BadRequestException(
          `Slot ${i + 1} overlaps the previous slot. Slots must be chronological and non-overlapping.`,
        );
      }

      if (slot.kind === PERIOD_SLOT_KIND.PERIOD) {
        if (slot.periodNumber == null) {
          throw new BadRequestException(
            `Slot ${i + 1}: PERIOD slots need a periodNumber.`,
          );
        }
        if (slot.periodNumber !== expectedPeriod) {
          throw new BadRequestException(
            `Slot ${i + 1}: period numbers must be contiguous starting at 1 (expected ${expectedPeriod}, got ${slot.periodNumber}).`,
          );
        }
        expectedPeriod++;
      } else if (slot.periodNumber != null) {
        throw new BadRequestException(
          `Slot ${i + 1}: only PERIOD slots may carry a periodNumber.`,
        );
      }
    });
  }

  private toSlotRows(slots: PeriodTemplateSlotDto[]) {
    return slots.map((slot, i) => ({
      sortOrder: i,
      kind: slot.kind,
      label: slot.label ?? null,
      startTime: slot.startTime,
      endTime: slot.endTime,
      periodNumber:
        slot.kind === PERIOD_SLOT_KIND.PERIOD ? slot.periodNumber! : null,
    }));
  }

  private isStructuralChange(
    template: {
      workingDays: number[];
      slots: { kind: string; periodNumber: number | null }[];
    },
    dto: UpdatePeriodTemplateDto,
  ): boolean {
    if (dto.workingDays !== undefined) {
      const before = [...template.workingDays].sort((a, b) => a - b).join(',');
      const after = [...dto.workingDays].sort((a, b) => a - b).join(',');
      if (before !== after) return true;
    }
    if (dto.slots !== undefined) {
      const before = template.slots
        .filter((s) => s.kind === PERIOD_SLOT_KIND.PERIOD)
        .map((s) => s.periodNumber)
        .join(',');
      const after = dto.slots
        .filter((s) => s.kind === PERIOD_SLOT_KIND.PERIOD)
        .map((s) => s.periodNumber)
        .join(',');
      if (before !== after) return true;
    }
    return false;
  }

  /** Timetables (any status except ARCHIVED) still built on this template. */
  private countLiveReferences(tenantId: string, periodTemplateId: string) {
    return this.prisma.timetable.count({
      where: {
        tenantId,
        periodTemplateId,
        deletedAt: null,
        status: { not: TIMETABLE_STATUS.ARCHIVED },
      },
    });
  }

  private async assertNameAvailable(
    tenantId: string,
    name: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.periodTemplate.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        name: { equals: name.trim(), mode: 'insensitive' as const },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `A period template named "${name.trim()}" already exists.`,
      );
    }
  }

  private rethrowDuplicateName(err: unknown, name: string): never {
    if ((err as { code?: string })?.code === 'P2002') {
      throw new ConflictException(
        `A period template named "${name.trim()}" already exists.`,
      );
    }
    throw err;
  }
}
