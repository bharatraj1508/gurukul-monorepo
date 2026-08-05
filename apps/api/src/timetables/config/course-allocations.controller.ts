import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
} from '../../common/decorators';
import { BulkCourseAllocationsDto } from '../dto';
import { CourseAllocationsService } from './course-allocations.service';

@ApiTags('Timetable Setup')
@ApiBearerAuth()
@Controller('course-allocations')
export class CourseAllocationsController {
  constructor(
    private readonly courseAllocationsService: CourseAllocationsService,
  ) {}

  @Get()
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: 'List course allocations' })
  @ApiQuery({ name: 'classId', required: false })
  @ApiOkResponse({ description: 'Allocations retrieved.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @Query('classId') classId?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.courseAllocationsService.findAll(tenantId, classId);
  }

  @Put('classes/:classId')
  @RequirePermissions(PERMS.timetable.manage)
  @ApiOperation({
    summary: "Replace a class's full allocation set (bulk upsert)",
  })
  @ApiOkResponse({ description: 'Allocations replaced.' })
  @ApiNotFoundResponse({ description: 'Class not found.' })
  async replaceForClass(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: BulkCourseAllocationsDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.courseAllocationsService.replaceForClass(
      tenantId,
      classId,
      userId,
      dto,
    );
  }
}
