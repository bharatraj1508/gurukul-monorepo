import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { PERMS } from '@repo/permissions';

import {
  GetCurrentTenant,
  GetCurrentUserId,
  RequirePermissions,
} from '../common/decorators';
import { TimetableViewerService } from './timetable-viewer.service';

const WEEK_START_QUERY = {
  name: 'weekStart',
  required: false,
  description:
    'Monday of the requested week (YYYY-MM-DD). Enables per-day dates and substitution badges.',
} as const;

@ApiTags('Timetable Viewer')
@ApiBearerAuth()
@Controller('timetable')
export class TimetableViewerController {
  constructor(private readonly viewerService: TimetableViewerService) {}

  @Get('viewer-context')
  @RequirePermissions(PERMS.timetable.viewOwn)
  @ApiOperation({
    summary: 'Personas (student/teacher/parent) + children of the caller',
  })
  @ApiOkResponse({ description: 'Viewer context retrieved.' })
  async getViewerContext(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.viewerService.getViewerContext(tenantId, userId);
  }

  @Get('me')
  @RequirePermissions(PERMS.timetable.viewOwn)
  @ApiOperation({ summary: "The calling student's published timetable" })
  @ApiQuery(WEEK_START_QUERY)
  @ApiOkResponse({ description: 'Timetable retrieved.' })
  @ApiNotFoundResponse({
    description: 'No student profile / enrolment / published timetable.',
  })
  async getMyTimetable(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.viewerService.getMyTimetable(tenantId, userId, weekStart);
  }

  @Get('teachers/me')
  @RequirePermissions(PERMS.timetable.viewOwn)
  @ApiOperation({
    summary:
      "The calling teacher's published lessons incl. substitute-in/out flags",
  })
  @ApiQuery(WEEK_START_QUERY)
  @ApiOkResponse({ description: 'Timetable retrieved.' })
  async getMyTeacherTimetable(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.viewerService.getMyTeacherTimetable(
      tenantId,
      userId,
      weekStart,
    );
  }

  @Get('students/:studentProfileId')
  @RequirePermissions(PERMS.timetable.viewOwn)
  @ApiOperation({ summary: "A linked child's published timetable (parents)" })
  @ApiQuery(WEEK_START_QUERY)
  @ApiOkResponse({ description: 'Timetable retrieved.' })
  @ApiForbiddenResponse({ description: 'Student is not linked to the caller.' })
  async getStudentTimetable(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('studentProfileId', ParseUUIDPipe) studentProfileId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.viewerService.getStudentTimetable(
      tenantId,
      userId,
      studentProfileId,
      weekStart,
    );
  }

  @Get('classes/:classId')
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: "Any class's published timetable (admin view)" })
  @ApiQuery(WEEK_START_QUERY)
  @ApiOkResponse({ description: 'Timetable retrieved.' })
  @ApiNotFoundResponse({
    description: 'Class or published timetable not found.',
  })
  async getClassTimetable(
    @GetCurrentTenant('id') tenantId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query('weekStart') weekStart?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.viewerService.getClassTimetable(tenantId, classId, weekStart);
  }
}
