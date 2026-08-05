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
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { CreateSubstitutionDto, UpdateSubstitutionDto } from '../dto';
import { SubstitutionsService } from './substitutions.service';

@ApiTags('Timetable Substitutions')
@ApiBearerAuth()
@Controller('timetable-substitutions')
export class SubstitutionsController {
  constructor(private readonly substitutionsService: SubstitutionsService) {}

  @Get()
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: 'List substitutions' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'classId', required: false })
  @ApiOkResponse({ description: 'Substitutions retrieved.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @Query('date') date?: string,
    @Query('classId') classId?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.substitutionsService.findAll(tenantId, { date, classId });
  }

  @Post()
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Schedule a substitution on the published timetable',
  })
  @ApiCreatedResponse({ description: 'Substitution created.' })
  @ApiConflictResponse({
    description: 'Substitute busy or duplicate slot/date.',
  })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateSubstitutionDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.substitutionsService.create(tenantId, userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMS.timetable.manage)
  @ApiOperation({ summary: 'Update a substitution' })
  @ApiOkResponse({ description: 'Substitution updated.' })
  @ApiNotFoundResponse({ description: 'Substitution not found.' })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubstitutionDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.substitutionsService.update(tenantId, id, userId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove (soft) a substitution' })
  @ApiOkResponse({ description: 'Substitution removed.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.substitutionsService.remove(tenantId, id, userId);
  }
}
