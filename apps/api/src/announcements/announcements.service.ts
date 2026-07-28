import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import { CreateAnnouncementDto, RejectAnnouncementDto, UpdateAnnouncementDto } from './dto';

const USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

  private isApproverRole(
    membership: { roles: { role: { name: string; isAdmin: boolean; rank: number } }[] },
    isAdminParam = false,
  ) {
    if (isAdminParam) return true;
    return membership.roles.some(
      (r) =>
        r.role.isAdmin ||
        ['Account Owner', 'Principal', 'Admin', 'Administrator'].includes(r.role.name),
    );
  }

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------
  async create(
    tenantId: string,
    userId: string,
    dto: CreateAnnouncementDto,
    isAdmin: boolean,
  ) {
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) throw new ForbiddenException('Tenant membership not found.');

    const isApprover = this.isApproverRole(membership, isAdmin);
    const now = new Date();
    const startDate = dto.sendImmediately ? now : new Date(dto.startDate!);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate.');
    }

    // Principals and Admins auto-approve their announcements. HoDs & Coordinators submit for approval.
    const status = isApprover ? 'APPROVED' : 'PENDING_APPROVAL';

    return this.prisma.announcement.create({
      data: {
        tenantId,
        title: dto.title,
        content: dto.content,
        status,
        startDate,
        endDate,
        createdBy: userId,
        ...(isApprover ? { approvedById: userId, approvedAt: now } : {}),
      },
      include: {
        creator: { select: USER_SELECT },
        approver: { select: USER_SELECT },
      },
    });
  }

  // -------------------------------------------------------------------------
  // FIND ALL
  // -------------------------------------------------------------------------
  async findAll(
    tenantId: string,
    userId: string,
    isAdmin: boolean,
    params?: {
      status?: string;
      active?: string;
    },
  ) {
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) return [];

    const isApprover = this.isApproverRole(membership, isAdmin);
    const now = new Date();
    const activeOnly = params?.active !== 'false';

    let whereClause: object;

    if (isApprover) {
      // Approvers/Principals: see all announcements (pending, approved, rejected)
      const base: Record<string, any> = { tenantId, deletedAt: null };
      if (params?.status) {
        base.status = params.status;
      }
      if (activeOnly && params?.status === 'APPROVED') {
        base.startDate = { lte: now };
        base.endDate = { gte: now };
      }
      whereClause = base;
    } else {
      // Non-approvers (HoDs, Coordinators, Teachers, Students, Parents):
      // - See all active & approved announcements
      // - Creators see their own submitted announcements regardless of status
      const approvedActiveCondition = {
        status: 'APPROVED',
        ...(activeOnly ? { startDate: { lte: now }, endDate: { gte: now } } : {}),
      };

      whereClause = {
        tenantId,
        deletedAt: null,
        OR: [
          approvedActiveCondition,
          { createdBy: userId }, // Creator can monitor pending/rejected status
        ],
      };
    }

    return this.prisma.announcement.findMany({
      where: whereClause,
      include: {
        creator: { select: USER_SELECT },
        approver: { select: USER_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // -------------------------------------------------------------------------
  // FIND ONE
  // -------------------------------------------------------------------------
  async findOne(tenantId: string, id: string) {
    const announcement = await this.prisma.announcement.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        creator: { select: USER_SELECT },
        approver: { select: USER_SELECT },
      },
    });
    if (!announcement) throw new NotFoundException(`Announcement ${id} not found.`);
    return announcement;
  }

  // -------------------------------------------------------------------------
  // APPROVE (Principal / Admin)
  // -------------------------------------------------------------------------
  async approve(tenantId: string, id: string, userId: string, isAdmin: boolean) {
    const announcement = await this.findOne(tenantId, id);
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) throw new ForbiddenException('Membership not found.');

    if (!this.isApproverRole(membership, isAdmin)) {
      throw new ForbiddenException('Only Principals and Admins can approve announcements.');
    }

    return this.prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        rejectionReason: null,
      },
      include: {
        creator: { select: USER_SELECT },
        approver: { select: USER_SELECT },
      },
    });
  }

  // -------------------------------------------------------------------------
  // REJECT (Principal / Admin)
  // -------------------------------------------------------------------------
  async reject(
    tenantId: string,
    id: string,
    userId: string,
    dto: RejectAnnouncementDto,
    isAdmin: boolean,
  ) {
    const announcement = await this.findOne(tenantId, id);
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) throw new ForbiddenException('Membership not found.');

    if (!this.isApproverRole(membership, isAdmin)) {
      throw new ForbiddenException('Only Principals and Admins can reject announcements.');
    }

    return this.prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        status: 'REJECTED',
        rejectionReason: dto.rejectionReason,
        approvedById: userId,
        approvedAt: new Date(),
      },
      include: {
        creator: { select: USER_SELECT },
        approver: { select: USER_SELECT },
      },
    });
  }

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------
  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateAnnouncementDto,
    isAdmin: boolean,
  ) {
    const announcement = await this.findOne(tenantId, id);
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) throw new ForbiddenException('Membership not found.');

    const isApprover = this.isApproverRole(membership, isAdmin);

    if (!isApprover && announcement.createdBy !== userId) {
      throw new ForbiddenException('You can only edit announcements you created.');
    }

    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      const newStartDate = dto.startDate ? new Date(dto.startDate) : announcement.startDate;
      const newEndDate = dto.endDate ? new Date(dto.endDate) : announcement.endDate;
      if (newEndDate <= newStartDate) {
        throw new BadRequestException('endDate must be after startDate.');
      }
    }

    // If previously rejected, editing resets status to PENDING_APPROVAL for re-review
    const statusUpdate =
      announcement.status === 'REJECTED' && !isApprover
        ? { status: 'PENDING_APPROVAL', rejectionReason: null }
        : {};

    return this.prisma.announcement.update({
      where: { id: announcement.id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        updatedBy: userId,
        ...statusUpdate,
      },
      include: {
        creator: { select: USER_SELECT },
        approver: { select: USER_SELECT },
      },
    });
  }

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------
  async remove(tenantId: string, id: string, userId: string, isAdmin: boolean) {
    const announcement = await this.findOne(tenantId, id);
    const membership = await this.getMembership(tenantId, userId);
    if (!membership) throw new ForbiddenException('Membership not found.');

    const isApprover = this.isApproverRole(membership, isAdmin);

    if (!isApprover && announcement.createdBy !== userId) {
      throw new ForbiddenException('You can only delete announcements you created.');
    }

    await this.prisma.announcement.update({
      where: { id: announcement.id },
      data: { deletedAt: new Date(), updatedBy: userId },
    });

    return { message: 'Announcement deleted successfully.' };
  }
}
