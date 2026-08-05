import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'nestjs-prisma';

import { BulkCourseAllocationsDto, CourseAllocationItemDto } from '../dto';

const ALLOCATION_INCLUDE = {
  course: { select: { id: true, name: true, code: true } },
  room: { select: { id: true, name: true, type: true } },
} as const;

@Injectable()
export class CourseAllocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, classId?: string) {
    return this.prisma.courseAllocation.findMany({
      where: { tenantId, deletedAt: null, ...(classId ? { classId } : {}) },
      include: ALLOCATION_INCLUDE,
      orderBy: [{ classId: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Replaces the full allocation set of a class: listed courses are upserted,
   * unlisted active allocations are soft-deleted.
   */
  async replaceForClass(
    tenantId: string,
    classId: string,
    userId: string,
    dto: BulkCourseAllocationsDto,
  ) {
    const klass = await this.prisma.class.findFirst({
      where: { id: classId, tenantId, deletedAt: null },
      select: { id: true, programId: true, name: true },
    });
    if (!klass) throw new NotFoundException(`Class ${classId} not found.`);

    await this.validateItems(tenantId, klass.programId, dto.allocations);

    // Includes soft-deleted rows: the (classId, courseId) unique spans them, so
    // re-adding a removed course must revive its row instead of creating one.
    const existing = await this.prisma.courseAllocation.findMany({
      where: { tenantId, classId },
      select: { id: true, courseId: true },
    });
    const existingByCourse = new Map(existing.map((a) => [a.courseId, a]));
    const keptCourseIds = dto.allocations.map((a) => a.courseId);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.courseAllocation.updateMany({
        where: {
          tenantId,
          classId,
          deletedAt: null,
          courseId: { notIn: keptCourseIds },
        },
        data: { deletedAt: now, updatedBy: userId },
      });

      for (const item of dto.allocations) {
        const fields = {
          periodsPerWeek: item.periodsPerWeek,
          consecutiveBlockSize: item.consecutiveBlockSize ?? 1,
          roomId: item.roomId ?? null,
          roomType: item.roomType ?? null,
        };
        const current = existingByCourse.get(item.courseId);
        if (current) {
          await tx.courseAllocation.update({
            where: { id: current.id },
            data: { ...fields, deletedAt: null, updatedBy: userId },
          });
        } else {
          await tx.courseAllocation.create({
            data: {
              tenantId,
              classId,
              courseId: item.courseId,
              ...fields,
              createdBy: userId,
            },
          });
        }
      }
    });

    return this.findAll(tenantId, classId);
  }

  private async validateItems(
    tenantId: string,
    programId: string,
    items: CourseAllocationItemDto[],
  ) {
    const courseIds = items.map((i) => i.courseId);
    if (new Set(courseIds).size !== courseIds.length) {
      throw new BadRequestException('Each course may only be allocated once.');
    }

    for (const item of items) {
      const blockSize = item.consecutiveBlockSize ?? 1;
      if (item.periodsPerWeek % blockSize !== 0) {
        throw new BadRequestException(
          `consecutiveBlockSize (${blockSize}) must divide periodsPerWeek (${item.periodsPerWeek}).`,
        );
      }
      if (item.roomId && item.roomType) {
        throw new BadRequestException(
          'Provide either roomId or roomType, not both.',
        );
      }
    }

    if (courseIds.length > 0) {
      const courses = await this.prisma.course.findMany({
        where: { id: { in: courseIds }, tenantId, deletedAt: null },
        select: { id: true, name: true, programId: true },
      });
      const byId = new Map(courses.map((c) => [c.id, c]));
      for (const courseId of courseIds) {
        const course = byId.get(courseId);
        if (!course) {
          throw new BadRequestException(`Course ${courseId} not found.`);
        }
        if (course.programId !== programId) {
          throw new BadRequestException(
            `Course "${course.name}" is not part of this class's program.`,
          );
        }
      }
    }

    const roomIds = items
      .map((i) => i.roomId)
      .filter((id): id is string => !!id);
    if (roomIds.length > 0) {
      const rooms = await this.prisma.room.findMany({
        where: { id: { in: roomIds }, tenantId, deletedAt: null },
        select: { id: true },
      });
      const found = new Set(rooms.map((r) => r.id));
      const missing = roomIds.find((id) => !found.has(id));
      if (missing) {
        throw new BadRequestException(`Room ${missing} not found.`);
      }
    }
  }
}
