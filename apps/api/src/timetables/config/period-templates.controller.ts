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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
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
import { CreatePeriodTemplateDto, UpdatePeriodTemplateDto } from '../dto';
import { PeriodTemplatesService } from './period-templates.service';

@ApiTags('Timetable Setup')
@ApiBearerAuth()
@Controller('period-templates')
export class PeriodTemplatesController {
  constructor(
    private readonly periodTemplatesService: PeriodTemplatesService,
  ) {}

  @Post()
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a period template' })
  @ApiCreatedResponse({ description: 'Template created.' })
  @ApiConflictResponse({
    description: 'A template with this name already exists.',
  })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreatePeriodTemplateDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.periodTemplatesService.create(tenantId, userId, dto);
  }

  @Get()
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: 'List period templates' })
  @ApiOkResponse({ description: 'Templates retrieved.' })
  async findAll(@GetCurrentTenant('id') tenantId: string) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.periodTemplatesService.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: 'Get a period template' })
  @ApiOkResponse({ description: 'Template retrieved.' })
  @ApiNotFoundResponse({ description: 'Template not found.' })
  async findOne(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.periodTemplatesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMS.timetable.manage)
  @ApiOperation({ summary: 'Update a period template' })
  @ApiOkResponse({ description: 'Template updated.' })
  @ApiConflictResponse({
    description: 'Structural change blocked by an active timetable.',
  })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeriodTemplateDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.periodTemplatesService.update(tenantId, id, userId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (soft) a period template' })
  @ApiOkResponse({ description: 'Template deleted.' })
  @ApiConflictResponse({
    description: 'Template is used by an active timetable.',
  })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.periodTemplatesService.remove(tenantId, id, userId);
  }
}
