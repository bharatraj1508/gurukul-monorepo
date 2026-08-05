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
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMS } from '@repo/permissions';

import {
  GetCurrentTenant,
  GetCurrentUserId,
  RequirePermissions,
} from '../../common/decorators';
import { UpsertTeacherConstraintDto } from '../dto';
import { TeacherConstraintsService } from './teacher-constraints.service';

@ApiTags('Timetable Setup')
@ApiBearerAuth()
@Controller('teacher-constraints')
export class TeacherConstraintsController {
  constructor(
    private readonly teacherConstraintsService: TeacherConstraintsService,
  ) {}

  @Get()
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: 'List teacher scheduling constraints' })
  @ApiOkResponse({ description: 'Constraints retrieved.' })
  async findAll(@GetCurrentTenant('id') tenantId: string) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.teacherConstraintsService.findAll(tenantId);
  }

  @Put(':tenantMembershipId')
  @RequirePermissions(PERMS.timetable.manage)
  @ApiOperation({ summary: "Upsert a teacher's scheduling constraints" })
  @ApiOkResponse({ description: 'Constraints saved.' })
  @ApiNotFoundResponse({ description: 'Membership not found.' })
  async upsert(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('tenantMembershipId', ParseUUIDPipe) tenantMembershipId: string,
    @Body() dto: UpsertTeacherConstraintDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.teacherConstraintsService.upsert(
      tenantId,
      tenantMembershipId,
      userId,
      dto,
    );
  }

  @Delete(':tenantMembershipId')
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Remove a teacher's scheduling constraints" })
  @ApiOkResponse({ description: 'Constraints removed.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('tenantMembershipId', ParseUUIDPipe) tenantMembershipId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.teacherConstraintsService.remove(
      tenantId,
      tenantMembershipId,
      userId,
    );
  }
}
