import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';
import { PrismaService } from 'nestjs-prisma';

import { UpsertTeacherConstraintDto } from '../dto';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

// Only the system Teacher role — mirrors the teacher directory's filter so a
// custom tenant role someone names "teacher" can't receive scheduling limits.
const TEACHER_ROLE_FILTER = {
  roles: {
    some: {
      role: {
        name: { equals: 'Teacher', mode: 'insensitive' as const },
        isSystemRole: true,
      },
    },
  },
};

@Injectable()
export class TeacherConstraintsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const constraints = await this.prisma.teacherConstraint.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        membership: { include: { user: { select: USER_SELECT } } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return constraints.map((c) => ({
      id: c.id,
      tenantMembershipId: c.tenantMembershipId,
      teacherName: `${c.membership.user.firstName} ${c.membership.user.lastName}`,
      maxPeriodsPerDay: c.maxPeriodsPerDay,
      maxPeriodsPerWeek: c.maxPeriodsPerWeek,
      maxConsecutivePeriods: c.maxConsecutivePeriods,
      availability: c.availability,
      updatedAt: c.updatedAt,
    }));
  }

  async upsert(
    tenantId: string,
    tenantMembershipId: string,
    userId: string,
    dto: UpsertTeacherConstraintDto,
  ) {
    await this.assertIsTeacher(tenantId, tenantMembershipId);
    this.validateAvailability(dto.availability);

    // Json columns can't take a raw null — map it to Prisma.DbNull explicitly.
    const availability =
      dto.availability == null
        ? Prisma.DbNull
        : (dto.availability as Prisma.InputJsonValue);

    const fields = {
      maxPeriodsPerDay: dto.maxPeriodsPerDay ?? null,
      maxPeriodsPerWeek: dto.maxPeriodsPerWeek ?? null,
      maxConsecutivePeriods: dto.maxConsecutivePeriods ?? null,
      availability,
    };

    // The unique on tenantMembershipId spans soft-deleted rows, so upsert (and
    // revive on update) instead of blind-creating.
    return this.prisma.teacherConstraint.upsert({
      where: { tenantMembershipId },
      update: { ...fields, deletedAt: null, updatedBy: userId },
      create: {
        tenantId,
        tenantMembershipId,
        ...fields,
        createdBy: userId,
      },
    });
  }

  async remove(tenantId: string, tenantMembershipId: string, userId: string) {
    const constraint = await this.prisma.teacherConstraint.findFirst({
      where: { tenantId, tenantMembershipId, deletedAt: null },
      select: { id: true },
    });
    if (!constraint) {
      throw new NotFoundException('No constraints found for this teacher.');
    }

    await this.prisma.teacherConstraint.update({
      where: { id: constraint.id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    return { message: 'Teacher constraints removed.' };
  }

  private async assertIsTeacher(tenantId: string, tenantMembershipId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { id: tenantMembershipId, tenantId, deletedAt: null },
      select: {
        id: true,
        roles: {
          select: { role: { select: { name: true, isSystemRole: true } } },
        },
      },
    });
    if (!membership) {
      throw new NotFoundException('Membership not found in this school.');
    }

    const isTeacher = membership.roles.some(
      (r) => r.role.isSystemRole && r.role.name.toLowerCase() === 'teacher',
    );
    if (!isTeacher) {
      throw new BadRequestException(
        'Constraints can only be set for members with the Teacher role.',
      );
    }
  }

  /** availability: keys "1".."7", values arrays of positive integers. */
  private validateAvailability(availability?: Record<string, number[]> | null) {
    if (availability == null) return;
    for (const [day, periods] of Object.entries(availability)) {
      const dayNum = Number(day);
      if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 7) {
        throw new BadRequestException(
          `availability keys must be ISO weekdays 1-7 (got "${day}").`,
        );
      }
      if (
        !Array.isArray(periods) ||
        periods.some((p) => !Number.isInteger(p) || p < 1)
      ) {
        throw new BadRequestException(
          `availability["${day}"] must be an array of positive period numbers.`,
        );
      }
    }
  }
}
