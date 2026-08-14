import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'nestjs-prisma';
import {
  CloneLessonPlanDto,
  CreateLessonPlanDto,
  ReviewLessonPlanDto,
  UpdateLessonPlanDto,
} from './dto';

// ─── Shared selects ──────────────────────────────────────────────────────────

const MEMBERSHIP_USER_SELECT = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  },
} as const;

const TOPIC_SELECT = {
  id: true,
  title: true,
  orderIndex: true,
  parentId: true,
} as const;

const ITEM_SELECT = {
  id: true,
  orderIndex: true,
  estimatedHours: true,
  methodology: true,
  resources: true,
  learningOutcomes: true,
  hodComment: true,
  syllabusTopic: { select: TOPIC_SELECT },
} as const;

const PLAN_INCLUDE = {
  class: { select: { id: true, name: true } },
  course: { select: { id: true, name: true, code: true } },
  academicTerm: { select: { id: true, name: true } },
  creator: { select: MEMBERSHIP_USER_SELECT },
  reviewer: { select: MEMBERSHIP_USER_SELECT },
  items: {
    orderBy: { orderIndex: 'asc' as const },
    select: ITEM_SELECT,
  },
  parentVersion: { select: { id: true, version: true, status: true } },
  childVersions: { select: { id: true, version: true, status: true, createdAt: true } },
} as const;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class LessonPlansService {
  private readonly logger = new Logger(LessonPlansService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Helper: resolve membership ID from userId ───────────────────────────

  private async resolveMembership(tenantId: string, userId: string) {
    const membership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId, userId, deletedAt: null },
      select: { id: true },
    });
    if (!membership) throw new ForbiddenException('Tenant membership not found.');
    return membership;
  }

  // ── Helper: assert plan exists and belongs to tenant ────────────────────

  private async findPlanOrThrow(tenantId: string, id: string) {
    const plan = await this.prisma.lessonPlan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: PLAN_INCLUDE,
    });
    if (!plan) throw new NotFoundException(`Lesson plan ${id} not found.`);
    return plan;
  }

  // ── Helper: create items for a plan ─────────────────────────────────────

  private buildItemsPayload(
    lessonPlanId: string,
    items: CreateLessonPlanDto['items'],
  ) {
    return items.map((item, idx) => ({
      lessonPlanId,
      syllabusTopicId: item.syllabusTopicId,
      estimatedHours: item.estimatedHours,
      methodology: item.methodology,
      resources: item.resources ?? null,
      learningOutcomes: item.learningOutcomes ?? null,
      orderIndex: item.orderIndex ?? idx,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────────

  async create(tenantId: string, userId: string, dto: CreateLessonPlanDto) {
    const membership = await this.resolveMembership(tenantId, userId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate <= startDate) {
      throw new BadRequestException('endDate must be after startDate.');
    }

    const status = dto.submitImmediately ? 'SUBMITTED' : 'DRAFT';
    const submittedAt = dto.submitImmediately ? new Date() : null;

    const plan = await this.prisma.lessonPlan.create({
      data: {
        tenantId,
        classId: dto.classId,
        courseId: dto.courseId,
        academicTermId: dto.academicTermId,
        createdById: membership.id,
        planType: dto.planType,
        weekNumber: dto.weekNumber ?? null,
        month: dto.month ?? null,
        year: dto.year,
        startDate,
        endDate,
        status,
        version: 1,
        submittedAt,
      },
      include: PLAN_INCLUDE,
    });

    // Bulk-create items
    if (dto.items.length > 0) {
      await this.prisma.lessonPlanItem.createMany({
        data: this.buildItemsPayload(plan.id, dto.items),
      });
    }

    return this.findPlanOrThrow(tenantId, plan.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND ALL  (scope-aware: viewOwn vs view)
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(
    tenantId: string,
    membershipId: string,
    scope: 'own' | 'all',
    params?: {
      status?: string;
      academicTermId?: string;
      classId?: string;
      courseId?: string;
    },
  ) {
    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      ...(scope === 'own' && { createdById: membershipId }),
      ...(params?.status && { status: params.status }),
      ...(params?.academicTermId && { academicTermId: params.academicTermId }),
      ...(params?.classId && { classId: params.classId }),
      ...(params?.courseId && { courseId: params.courseId }),
    };

    return this.prisma.lessonPlan.findMany({
      where,
      include: PLAN_INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FIND ONE
  // ─────────────────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string, membershipId: string, canViewAll: boolean) {
    const plan = await this.findPlanOrThrow(tenantId, id);
    if (!canViewAll && plan.createdById !== membershipId) {
      throw new ForbiddenException('You can only view your own lesson plans.');
    }
    return plan;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE (DRAFT or REVISION_REQUESTED only)
  // ─────────────────────────────────────────────────────────────────────────

  async update(tenantId: string, userId: string, id: string, dto: UpdateLessonPlanDto) {
    const membership = await this.resolveMembership(tenantId, userId);
    const plan = await this.findPlanOrThrow(tenantId, id);

    if (plan.createdById !== membership.id) {
      throw new ForbiddenException('You can only edit your own lesson plans.');
    }
    if (!['DRAFT', 'REVISION_REQUESTED'].includes(plan.status)) {
      throw new BadRequestException(
        'Only DRAFT or REVISION_REQUESTED plans can be edited.',
      );
    }

    if (dto.startDate && dto.endDate) {
      const s = new Date(dto.startDate);
      const e = new Date(dto.endDate);
      if (e <= s) throw new BadRequestException('endDate must be after startDate.');
    }

    await this.prisma.lessonPlan.update({
      where: { id },
      data: {
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.weekNumber !== undefined && { weekNumber: dto.weekNumber }),
        ...(dto.month !== undefined && { month: dto.month }),
      },
    });

    // Full replacement of items when provided
    if (dto.items !== undefined) {
      await this.prisma.lessonPlanItem.deleteMany({ where: { lessonPlanId: id } });
      if (dto.items.length > 0) {
        await this.prisma.lessonPlanItem.createMany({
          data: dto.items.map((item, idx) => ({
            lessonPlanId: id,
            syllabusTopicId: item.syllabusTopicId!,
            estimatedHours: item.estimatedHours ?? 1,
            methodology: item.methodology ?? 'Lecture',
            resources: item.resources ?? null,
            learningOutcomes: item.learningOutcomes ?? null,
            orderIndex: item.orderIndex ?? idx,
          })),
        });
      }
    }

    return this.findPlanOrThrow(tenantId, id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT (DRAFT → SUBMITTED)
  // ─────────────────────────────────────────────────────────────────────────

  async submit(tenantId: string, userId: string, id: string) {
    const membership = await this.resolveMembership(tenantId, userId);
    const plan = await this.findPlanOrThrow(tenantId, id);

    if (plan.createdById !== membership.id) {
      throw new ForbiddenException('You can only submit your own lesson plans.');
    }
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT plans can be submitted.');
    }

    return this.prisma.lessonPlan.update({
      where: { id },
      data: { status: 'SUBMITTED', submittedAt: new Date() },
      include: PLAN_INCLUDE,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // APPROVE (HoD / Coordinator)
  // ─────────────────────────────────────────────────────────────────────────

  async approve(tenantId: string, userId: string, id: string, dto: ReviewLessonPlanDto) {
    const membership = await this.resolveMembership(tenantId, userId);
    const plan = await this.findPlanOrThrow(tenantId, id);

    if (plan.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED plans can be approved.');
    }

    return this.prisma.lessonPlan.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: membership.id,
        reviewedAt: new Date(),
        approvedAt: new Date(),
        generalRemarks: dto.generalRemarks ?? null,
      },
      include: PLAN_INCLUDE,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REQUEST REVISION (HoD / Coordinator)
  // ─────────────────────────────────────────────────────────────────────────

  async requestRevision(
    tenantId: string,
    userId: string,
    id: string,
    dto: ReviewLessonPlanDto,
  ) {
    const membership = await this.resolveMembership(tenantId, userId);
    const plan = await this.findPlanOrThrow(tenantId, id);

    if (plan.status !== 'SUBMITTED') {
      throw new BadRequestException('Only SUBMITTED plans can receive revision requests.');
    }

    // Apply inline per-topic comments
    if (dto.topicComments && dto.topicComments.length > 0) {
      for (const tc of dto.topicComments) {
        await this.prisma.lessonPlanItem.updateMany({
          where: { id: tc.itemId, lessonPlanId: id },
          data: { hodComment: tc.comment },
        });
      }
    }

    return this.prisma.lessonPlan.update({
      where: { id },
      data: {
        status: 'REVISION_REQUESTED',
        reviewedById: membership.id,
        reviewedAt: new Date(),
        generalRemarks: dto.generalRemarks ?? null,
      },
      include: PLAN_INCLUDE,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESUBMIT (Teacher: REVISION_REQUESTED → new version → SUBMITTED)
  // Creates a new LessonPlan row linked via parentVersionId for audit history.
  // ─────────────────────────────────────────────────────────────────────────

  async resubmit(tenantId: string, userId: string, id: string) {
    const membership = await this.resolveMembership(tenantId, userId);
    const original = await this.findPlanOrThrow(tenantId, id);

    if (original.createdById !== membership.id) {
      throw new ForbiddenException('You can only resubmit your own lesson plans.');
    }
    if (original.status !== 'REVISION_REQUESTED') {
      throw new BadRequestException('Only REVISION_REQUESTED plans can be resubmitted.');
    }

    // Create the new version
    const newPlan = await this.prisma.lessonPlan.create({
      data: {
        tenantId,
        classId: original.classId,
        courseId: original.courseId,
        academicTermId: original.academicTermId,
        createdById: membership.id,
        planType: original.planType,
        weekNumber: original.weekNumber,
        month: original.month,
        year: original.year,
        startDate: original.startDate,
        endDate: original.endDate,
        status: 'SUBMITTED',
        version: original.version + 1,
        parentVersionId: id,
        submittedAt: new Date(),
      },
    });

    // Copy items (clearing hodComments for fresh review)
    const sourceItems = await this.prisma.lessonPlanItem.findMany({
      where: { lessonPlanId: id },
    });
    if (sourceItems.length > 0) {
      await this.prisma.lessonPlanItem.createMany({
        data: sourceItems.map((item) => ({
          lessonPlanId: newPlan.id,
          syllabusTopicId: item.syllabusTopicId,
          estimatedHours: item.estimatedHours,
          methodology: item.methodology,
          resources: item.resources,
          learningOutcomes: item.learningOutcomes,
          orderIndex: item.orderIndex,
          hodComment: null,
        })),
      });
    }

    return this.findPlanOrThrow(tenantId, newPlan.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CLONE (Approved plan → new DRAFT for a different class/term)
  // ─────────────────────────────────────────────────────────────────────────

  async clone(tenantId: string, userId: string, id: string, dto: CloneLessonPlanDto) {
    const membership = await this.resolveMembership(tenantId, userId);
    const source = await this.findPlanOrThrow(tenantId, id);

    if (source.status !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED plans can be cloned.');
    }

    const newPlan = await this.prisma.lessonPlan.create({
      data: {
        tenantId,
        classId: dto.classId,
        courseId: source.courseId,
        academicTermId: dto.academicTermId,
        createdById: membership.id,
        planType: source.planType,
        weekNumber: source.weekNumber,
        month: source.month,
        year: source.year,
        startDate: source.startDate,
        endDate: source.endDate,
        status: 'DRAFT',
        version: 1,
        parentVersionId: id,
      },
    });

    const sourceItems = await this.prisma.lessonPlanItem.findMany({
      where: { lessonPlanId: id },
    });
    if (sourceItems.length > 0) {
      await this.prisma.lessonPlanItem.createMany({
        data: sourceItems.map((item) => ({
          lessonPlanId: newPlan.id,
          syllabusTopicId: item.syllabusTopicId,
          estimatedHours: item.estimatedHours,
          methodology: item.methodology,
          resources: item.resources,
          learningOutcomes: item.learningOutcomes,
          orderIndex: item.orderIndex,
          hodComment: null,
        })),
      });
    }

    return this.findPlanOrThrow(tenantId, newPlan.id);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DELETE (soft, DRAFT only)
  // ─────────────────────────────────────────────────────────────────────────

  async remove(tenantId: string, userId: string, id: string) {
    const membership = await this.resolveMembership(tenantId, userId);
    const plan = await this.findPlanOrThrow(tenantId, id);

    if (plan.createdById !== membership.id) {
      throw new ForbiddenException('You can only delete your own lesson plans.');
    }
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT plans can be deleted.');
    }

    await this.prisma.lessonPlan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Lesson plan deleted.' };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WORK DIARY PRE-FILL STUB
  // ─────────────────────────────────────────────────────────────────────────

  async workDiaryPrefill(tenantId: string, userId: string, id: string) {
    const membership = await this.resolveMembership(tenantId, userId);
    const plan = await this.findPlanOrThrow(tenantId, id);

    if (plan.createdById !== membership.id) {
      throw new ForbiddenException('You can only access your own lesson plans.');
    }

    // Returns a structured pre-fill payload; Work Diary module will consume this.
    return {
      lessonPlanId: plan.id,
      classId: plan.classId,
      courseId: plan.courseId,
      academicTermId: plan.academicTermId,
      date: new Date().toISOString().split('T')[0],
      topics: plan.items.map((item) => ({
        syllabusTopicId: item.syllabusTopic.id,
        topicTitle: item.syllabusTopic.title,
        methodology: item.methodology,
        estimatedHours: item.estimatedHours,
        resources: item.resources,
        learningOutcomes: item.learningOutcomes,
      })),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HOD DASHBOARD SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  async reviewSummary(tenantId: string) {
    // Count plans grouped by status for the dashboard overview card
    const [total, submitted, approved, revisionRequested] = await Promise.all([
      this.prisma.lessonPlan.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.lessonPlan.count({ where: { tenantId, status: 'SUBMITTED', deletedAt: null } }),
      this.prisma.lessonPlan.count({ where: { tenantId, status: 'APPROVED', deletedAt: null } }),
      this.prisma.lessonPlan.count({ where: { tenantId, status: 'REVISION_REQUESTED', deletedAt: null } }),
    ]);
    return { total, submitted, approved, revisionRequested };
  }
}
