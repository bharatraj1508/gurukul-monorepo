import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
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
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto } from './dto';

@ApiTags('Courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @RequirePermissions(PERMS.course.create)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new course',
    description:
      'Creates a new course associated with a program for the current tenant.',
  })
  @ApiOkResponse({ description: 'Course created successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateCourseDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.coursesService.create(tenantId, userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List courses',
    description:
      'Returns non-deleted courses for the current tenant, filterable by program. ' +
      'Users with course.view see all courses; users with only course.viewOwn ' +
      '(e.g. students) see only courses in the program(s) of their active class enrolments.',
  })
  @ApiQuery({
    name: 'programId',
    required: false,
    type: String,
    description: 'Filter by academic program ID',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search string matching course name or code',
  })
  @ApiOkResponse({ description: 'Courses retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayloadWithRt,
    @Query('programId') programId?: string,
    @Query('search') search?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    const scope = getViewScope(user.scopes, 'course', {
      isAdmin: user.isAdmin,
    });
    if (scope === 'none') {
      throw new ForbiddenException(
        'You do not have permission to view courses.',
      );
    }
    return this.coursesService.findAll(
      tenantId,
      { programId, search },
      { scope, membershipId: user.membershipId },
    );
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get course details by ID',
    description:
      'Returns details of a specific course, including program info. ' +
      'Users with only course.viewOwn can only access courses in the ' +
      'program(s) of their active class enrolments.',
  })
  @ApiOkResponse({ description: 'Course details retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async findOne(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayloadWithRt,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    const scope = getViewScope(user.scopes, 'course', {
      isAdmin: user.isAdmin,
    });
    if (scope === 'none') {
      throw new ForbiddenException(
        'You do not have permission to view courses.',
      );
    }
    return this.coursesService.findOne(tenantId, id, {
      scope,
      membershipId: user.membershipId,
    });
  }

  @Patch(':id')
  @RequirePermissions(PERMS.course.edit)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update course details',
    description: 'Updates parameters of an existing academic course.',
  })
  @ApiOkResponse({ description: 'Course updated successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.coursesService.update(tenantId, userId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.course.delete)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete course',
    description:
      'Soft deletes an academic course if no class sections are scheduled for its program.',
  })
  @ApiOkResponse({ description: 'Course deleted successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    await this.coursesService.remove(tenantId, userId, id);
    return { message: 'Course deleted successfully.' };
  }
}
