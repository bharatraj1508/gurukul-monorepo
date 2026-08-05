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

import { PERMS } from '@repo/permissions';

import {
  GetCurrentTenant,
  GetCurrentUser,
  RequirePermissions,
} from '../common/decorators';
import type { JwtPayload } from '../users/types';
import { DiaryService } from './diary.service';
import { CreateDiaryDto, UpdateDiaryDto } from './dto';

@ApiTags('Work Diary')
@ApiBearerAuth()
@Controller('diary')
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  @Get()
  @ApiOperation({
    summary: 'List work diary notes',
    description:
      "Returns diary notes scoped by the caller's diary view access (all / own).",
  })
  @ApiQuery({ name: 'classId', required: false, type: String })
  @ApiQuery({ name: 'termId', required: false, type: String })
  @ApiQuery({ name: 'courseId', required: false, type: String })
  @ApiOkResponse({ description: 'Diary notes retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'No diary access.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayload,
    @Query('classId') classId?: string,
    @Query('termId') termId?: string,
    @Query('courseId') courseId?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.diaryService.findAll(tenantId, user, {
      classId,
      termId,
      courseId,
    });
  }

  @Get('options')
  @RequirePermissions(PERMS.diary.create)
  @ApiOperation({
    summary: 'List classes the caller can author diary notes for',
    description:
      'Returns each authorable class with its program, term, courses, and active students — used to populate the create/edit form.',
  })
  @ApiOkResponse({ description: 'Diary form options retrieved successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async getOptions(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayload,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.diaryService.getOptions(tenantId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a work diary note' })
  @ApiOkResponse({ description: 'Diary note retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Diary note not found.' })
  async findOne(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.diaryService.findOne(tenantId, user, id);
  }

  @Post()
  @RequirePermissions(PERMS.diary.create)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a work diary note',
    description:
      'Creates a diary note for a class (optionally course- or student-scoped).',
  })
  @ApiCreatedResponse({ description: 'Diary note created successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayload,
    @Body() dto: CreateDiaryDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.diaryService.create(tenantId, user, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMS.diary.edit)
  @ApiOperation({ summary: 'Update a work diary note' })
  @ApiOkResponse({ description: 'Diary note updated successfully.' })
  @ApiNotFoundResponse({ description: 'Diary note not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiaryDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.diaryService.update(tenantId, user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.diary.delete)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a work diary note',
    description: 'Soft-deletes the diary note.',
  })
  @ApiOkResponse({ description: 'Diary note deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Diary note not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.diaryService.remove(tenantId, user, id);
  }
}
