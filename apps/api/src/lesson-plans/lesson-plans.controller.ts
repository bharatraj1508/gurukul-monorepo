import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PERMS, getViewScope } from '@repo/permissions';
import {
  GetCurrentTenant,
  GetCurrentUser,
  GetCurrentUserId,
  RequirePermissions,
} from '../common/decorators';
import type { JwtPayloadWithRt } from '../users/types';
import { LessonPlansService } from './lesson-plans.service';
import {
  CloneLessonPlanDto,
  CreateLessonPlanDto,
  ReviewLessonPlanDto,
  UpdateLessonPlanDto,
} from './dto';

@ApiTags('Lesson Plans')
@ApiBearerAuth()
@Controller('lesson-plans')
export class LessonPlansController {
  constructor(private readonly lessonPlansService: LessonPlansService) {}

  // ─── Create ────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions(PERMS.lessonPlan.create)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a lesson plan (draft or submit immediately)' })
  @ApiCreatedResponse({ description: 'Lesson plan created.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateLessonPlanDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.create(tenantId, userId, dto);
  }

  // ─── List ──────────────────────────────────────────────────────────────────

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List lesson plans',
    description:
      'Teachers with lessonPlan.viewOwn see only their own plans. ' +
      'HoDs/Coordinators with lessonPlan.view see all plans in the tenant.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'DRAFT | SUBMITTED | APPROVED | REVISION_REQUESTED' })
  @ApiQuery({ name: 'academicTermId', required: false })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'courseId', required: false })
  @ApiOkResponse({ description: 'Lesson plans retrieved.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayloadWithRt,
    @Query('status') status?: string,
    @Query('academicTermId') academicTermId?: string,
    @Query('classId') classId?: string,
    @Query('courseId') courseId?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    const scope = getViewScope(user.scopes, 'lessonPlan', { isAdmin: user.isAdmin });
    if (scope === 'none') {
      throw new ForbiddenException('You do not have permission to view lesson plans.');
    }
    if (!user.membershipId) throw new ForbiddenException('Tenant membership required.');
    return this.lessonPlansService.findAll(
      tenantId,
      user.membershipId,
      scope === 'own' ? 'own' : 'all',
      { status, academicTermId, classId, courseId },
    );
  }

  // ─── Review summary (HoD dashboard) ───────────────────────────────────────

  @Get('review/summary')
  @RequirePermissions(PERMS.lessonPlan.approve)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'HoD dashboard: submission counts by status' })
  @ApiOkResponse({ description: 'Summary counts returned.' })
  async reviewSummary(@GetCurrentTenant('id') tenantId: string) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.reviewSummary(tenantId);
  }

  // ─── Detail ────────────────────────────────────────────────────────────────

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a lesson plan by ID' })
  @ApiOkResponse({ description: 'Lesson plan retrieved.' })
  @ApiNotFoundResponse({ description: 'Not found.' })
  async findOne(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayloadWithRt,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    const scope = getViewScope(user.scopes, 'lessonPlan', { isAdmin: user.isAdmin });
    if (scope === 'none') {
      throw new ForbiddenException('You do not have permission to view lesson plans.');
    }
    if (!user.membershipId) throw new ForbiddenException('Tenant membership required.');
    return this.lessonPlansService.findOne(
      tenantId,
      id,
      user.membershipId,
      scope !== 'own',
    );
  }

  // ─── Update (draft / revision-requested) ──────────────────────────────────

  @Patch(':id')
  @RequirePermissions(PERMS.lessonPlan.edit)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a draft or revision-requested lesson plan' })
  @ApiOkResponse({ description: 'Lesson plan updated.' })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonPlanDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.update(tenantId, userId, id, dto);
  }

  // ─── Submit ────────────────────────────────────────────────────────────────

  @Post(':id/submit')
  @RequirePermissions(PERMS.lessonPlan.edit)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit a draft lesson plan for HoD review' })
  @ApiOkResponse({ description: 'Lesson plan submitted.' })
  async submit(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.submit(tenantId, userId, id);
  }

  // ─── Approve ───────────────────────────────────────────────────────────────

  @Post(':id/approve')
  @RequirePermissions(PERMS.lessonPlan.approve)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a submitted lesson plan' })
  @ApiOkResponse({ description: 'Lesson plan approved.' })
  async approve(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewLessonPlanDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.approve(tenantId, userId, id, dto);
  }

  // ─── Request Revision ──────────────────────────────────────────────────────

  @Post(':id/request-revision')
  @RequirePermissions(PERMS.lessonPlan.approve)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request revision on a submitted lesson plan with inline comments' })
  @ApiOkResponse({ description: 'Revision requested.' })
  async requestRevision(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewLessonPlanDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.requestRevision(tenantId, userId, id, dto);
  }

  // ─── Resubmit (version increment) ─────────────────────────────────────────

  @Post(':id/resubmit')
  @RequirePermissions(PERMS.lessonPlan.edit)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resubmit a revision-requested plan as a new version' })
  @ApiOkResponse({ description: 'New version submitted.' })
  async resubmit(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.resubmit(tenantId, userId, id);
  }

  // ─── Clone ─────────────────────────────────────────────────────────────────

  @Post(':id/clone')
  @RequirePermissions(PERMS.lessonPlan.create)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clone an approved lesson plan into a new class/term draft' })
  @ApiCreatedResponse({ description: 'Cloned lesson plan created as draft.' })
  async clone(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloneLessonPlanDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.clone(tenantId, userId, id, dto);
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  @Delete(':id')
  @RequirePermissions(PERMS.lessonPlan.delete)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete a draft lesson plan' })
  @ApiOkResponse({ description: 'Lesson plan deleted.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.remove(tenantId, userId, id);
  }

  // ─── Work Diary Pre-fill stub ──────────────────────────────────────────────

  @Get(':id/work-diary-prefill')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Work Diary pre-fill payload for a lesson plan (stub)' })
  @ApiOkResponse({ description: 'Pre-fill payload returned.' })
  async workDiaryPrefill(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.lessonPlansService.workDiaryPrefill(tenantId, userId, id);
  }
}
