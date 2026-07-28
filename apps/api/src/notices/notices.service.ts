import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Get all classIds where the user is an instructor (not deleted) */
  private async getInstructorClassIds(
    tenantId: string,
    membershipId: string,
  ): Promise<string[]> {
    const rows = await this.prisma.classInstructor.findMany({
      where: { tenantId, tenantMembershipId: membershipId, deletedAt: null },
      select: { classId: true },
    });
    return rows.map((r) => r.classId);
  }

  /** Get the active membership for a user in this tenant */
  private async getMembership(tenantId: string, userId: string) {
    return this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: {
        id: true,
        roles: {
          select: {
            role: { select: { name: true, isAdmin: true, rank: true } },
          },
        },
      },
    });
  }

  /** Derive a simplified role context from membership */
  private getRoleContext(
    membership: {
      roles: { role: { name: string; isAdmin: boolean; rank: number } }[];
    },
    isAdminParam = false,
  ) {
    const isAdmin =
      isAdminParam || membership.roles.some((r) => r.role.isAdmin);
    const roleNames = membership.roles.map((r) => r.role.name);
    const isCoordinator =
      isAdmin ||
      roleNames.some((n) =>
        ['Account Owner', 'Principal', 'Coordinators', 'Admin', 'Administrator'].includes(n),
      );
    const isHod = !isCoordinator && roleNames.includes('HoD');
    const isTeacherOrIncharge =
      !isCoordinator &&
      !isHod &&
      roleNames.some((n) => ['Teacher', 'Class Incharge'].includes(n));
    return { isAdmin, isCoordinator, isHod, isTeacherOrIncharge };
  }

  // -------------------------------------------------------------------------
  // Active date filter helper
  // -------------------------------------------------------------------------
  private activeFilter(now: Date) {
    return { startDate: { lte: now }, endDate: { gte: now }, deletedAt: null };
  }

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------
  async create(
    tenantId: string,
    userId: string,
    dto: CreateNoticeDto,
    isAdmin: boolean,
  ) {
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) throw new ForbiddenException('Tenant membership not found.');

    const { isCoordinator, isHod } = this.getRoleContext(membership, isAdmin);
    const membershipId = membership.id;

    // Validate scope authorisation
    if (dto.scope === 'SCHOOL_WIDE' && !isCoordinator) {
      throw new ForbiddenException('Only coordinators and admins can create school-wide notices.');
    }
    if (dto.scope === 'TEACHERS_ONLY' && !isCoordinator && !isHod) {
      throw new ForbiddenException('Only coordinators, admins, and HODs can create teacher-only notices.');
    }

    // Validate class ownership for CLASS scope
    if (dto.scope === 'CLASS') {
      if (!dto.classIds?.length) {
        throw new ForbiddenException('classIds are required for CLASS scope notices.');
      }
      if (!isCoordinator && !isHod) {
        // Teacher: must be instructor of all target classes
        const instructorClassIds = await this.getInstructorClassIds(tenantId, membershipId);
        const unauthorized = dto.classIds.filter((id) => !instructorClassIds.includes(id));
        if (unauthorized.length > 0) {
          throw new ForbiddenException(
            `You are not an instructor of the following classes: ${unauthorized.join(', ')}`,
          );
        }
      } else {
        // HOD / Coordinator: validate classes belong to this tenant
        const count = await this.prisma.class.count({
          where: { id: { in: dto.classIds }, tenantId, deletedAt: null },
        });
        if (count !== dto.classIds.length) {
          throw new ForbiddenException('One or more classes not found in this tenant.');
        }
      }
    }

    const now = new Date();
    const startDate = dto.sendImmediately ? now : new Date(dto.startDate!);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate.');
    }

    const notice = await this.prisma.notice.create({
      data: {
        tenantId,
        title: dto.title,
        content: dto.content,
        scope: dto.scope,
        startDate,
        endDate,
        createdBy: userId,
        ...(dto.scope === 'CLASS' && dto.classIds?.length
          ? {
              classes: {
                create: dto.classIds.map((classId) => ({ classId })),
              },
            }
          : {}),
      },
      include: {
        classes: { include: { class: { select: { id: true, name: true } } } },
        creator: { select: USER_SELECT },
      },
    });
    return notice;
  }

  // -------------------------------------------------------------------------
  // FIND ALL (role-aware)
  // -------------------------------------------------------------------------
  async findAll(
    tenantId: string,
    userId: string,
    isAdmin: boolean,
    params?: {
      scope?: string;
      classId?: string;
      active?: string;
    },
  ) {
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) return [];

    const { isCoordinator, isHod, isTeacherOrIncharge } = this.getRoleContext(membership, isAdmin);
    const membershipId = membership.id;
    const now = new Date();
    const activeOnly = params?.active !== 'false';
    const dateFilter = activeOnly ? this.activeFilter(now) : { deletedAt: null };

    // Build the base where clause based on role
    let scopeWhere: object;

    if (isCoordinator) {
      // Admins/Coordinators: see everything
      const filters: object[] = [{ ...dateFilter }];
      if (params?.scope) {
        Object.assign(filters[0] as object, { scope: params.scope });
      }
      if (params?.classId) {
        Object.assign(filters[0] as object, {
          classes: { some: { classId: params.classId } },
        });
      }
      scopeWhere = filters[0];
    } else if (isHod) {
      // HOD: sees all scopes but CLASS notices only for their dept classes
      const hodClassIds = await this.getInstructorClassIds(tenantId, membershipId);
      // Also get classes from programs they oversee (via their instructor assignments)
      scopeWhere = {
        ...dateFilter,
        OR: [
          { scope: 'SCHOOL_WIDE' },
          { scope: 'TEACHERS_ONLY' },
          {
            scope: 'CLASS',
            classes: { some: { classId: { in: hodClassIds } } },
          },
        ],
      };
    } else if (isTeacherOrIncharge) {
      // Teacher: sees school-wide + teachers-only + class notices for their classes
      const teacherClassIds = await this.getInstructorClassIds(tenantId, membershipId);
      scopeWhere = {
        ...dateFilter,
        OR: [
          { scope: 'SCHOOL_WIDE' },
          { scope: 'TEACHERS_ONLY' },
          {
            scope: 'CLASS',
            classes: { some: { classId: { in: teacherClassIds } } },
          },
        ],
      };
    } else {
      // Student / Parent: sees school-wide + class notices for enrolled classes (self or wards)
      const studentEnrolments = await this.prisma.enrolment.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          student: {
            deletedAt: null,
            OR: [
              { tenantMembershipId: membershipId },
              {
                parents: {
                  some: {
                    parent: { tenantMembershipId: membershipId },
                  },
                },
              },
            ],
          },
          deletedAt: null,
        },
        select: { classId: true },
      });
      const studentClassIds = studentEnrolments.map((e) => e.classId);

      scopeWhere = {
        ...dateFilter,
        OR: [
          { scope: 'SCHOOL_WIDE' },
          {
            scope: 'CLASS',
            classes: { some: { classId: { in: studentClassIds } } },
          },
        ],
      };
    }

    const notices = await this.prisma.notice.findMany({
      where: {
        tenantId,
        ...(scopeWhere as object),
      },
      include: {
        classes: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                program: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        creator: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });

    return notices;
  }

  // -------------------------------------------------------------------------
  // FIND ONE
  // -------------------------------------------------------------------------
  async findOne(tenantId: string, id: string) {
    const notice = await this.prisma.notice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        classes: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                program: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        creator: { select: USER_SELECT },
        updater: { select: USER_SELECT },
      },
    });
    if (!notice) throw new NotFoundException(`Notice ${id} not found.`);
    return notice;
  }

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------
  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateNoticeDto,
    isAdmin: boolean,
  ) {
    const notice = await this.findOne(tenantId, id);
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) throw new ForbiddenException('Membership not found.');
    const { isCoordinator, isHod } = this.getRoleContext(membership, isAdmin);

    // Only author or coordinator/admin can edit
    if (!isCoordinator && notice.createdBy !== userId) {
      throw new ForbiddenException('You can only edit notices you created.');
    }

    // Re-run scope authorization whenever dto.scope is provided
    if (dto.scope !== undefined) {
      if (dto.scope === 'SCHOOL_WIDE' && !isCoordinator) {
        throw new ForbiddenException('Only coordinators and admins can set school-wide scope.');
      }
      if (dto.scope === 'TEACHERS_ONLY' && !isCoordinator && !isHod) {
        throw new ForbiddenException('Only coordinators, admins, and HODs can set teacher-only scope.');
      }
    }

    // Re-run class ownership & tenant validation when dto.classIds is provided
    if (dto.classIds !== undefined && dto.classIds.length) {
      if (!isCoordinator && !isHod) {
        const instructorClassIds = await this.getInstructorClassIds(tenantId, membership.id);
        const unauthorized = dto.classIds.filter((cid) => !instructorClassIds.includes(cid));
        if (unauthorized.length > 0) {
          throw new ForbiddenException(
            `You are not an instructor of the following classes: ${unauthorized.join(', ')}`,
          );
        }
      } else {
        const count = await this.prisma.class.count({
          where: { id: { in: dto.classIds }, tenantId, deletedAt: null },
        });
        if (count !== dto.classIds.length) {
          throw new ForbiddenException('One or more classes not found in this tenant.');
        }
      }
    }

    // Re-run date range validation when dates are updated
    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      const newStartDate = dto.startDate ? new Date(dto.startDate) : notice.startDate;
      const newEndDate = dto.endDate ? new Date(dto.endDate) : notice.endDate;
      if (newEndDate <= newStartDate) {
        throw new BadRequestException('endDate must be after startDate.');
      }
    }

    // Handle classIds update
    const classUpdate =
      dto.classIds !== undefined
        ? {
            classes: {
              deleteMany: {},
              create: dto.classIds.map((classId) => ({ classId })),
            },
          }
        : {};

    return this.prisma.notice.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.scope !== undefined && { scope: dto.scope }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        updatedBy: userId,
        ...classUpdate,
      },
      include: {
        classes: { include: { class: { select: { id: true, name: true } } } },
        creator: { select: USER_SELECT },
      },
    });
  }

  // -------------------------------------------------------------------------
  // SOFT DELETE
  // -------------------------------------------------------------------------
  async remove(tenantId: string, id: string, userId: string, isAdmin: boolean) {
    const notice = await this.findOne(tenantId, id);
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) throw new ForbiddenException('Membership not found.');
    const { isCoordinator } = this.getRoleContext(membership, isAdmin);

    if (!isCoordinator && notice.createdBy !== userId) {
      throw new ForbiddenException('You can only delete notices you created.');
    }

    await this.prisma.notice.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });
    return { message: 'Notice deleted successfully.' };
  }
}
