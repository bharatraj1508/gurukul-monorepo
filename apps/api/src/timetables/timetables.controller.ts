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
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { PERMS } from '@repo/permissions';

import {
  GetCurrentTenant,
  GetCurrentUserId,
  RequirePermissions,
} from '../common/decorators';
import {
  DuplicateTimetableDto,
  GenerateTimetableDto,
  MoveSlotDto,
  PreflightTimetableDto,
  RenameTimetableDto,
  SwapSlotsDto,
} from './dto';
import { TimetableEditorService } from './timetable-editor.service';
import { TimetablesService } from './timetables.service';

@ApiTags('Timetables')
@ApiBearerAuth()
@Controller('timetables')
export class TimetablesController {
  constructor(
    private readonly timetablesService: TimetablesService,
    private readonly editorService: TimetableEditorService,
  ) {}

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  @Get()
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: 'List timetable versions' })
  @ApiQuery({ name: 'academicTermId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiOkResponse({ description: 'Timetables retrieved.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @Query('academicTermId') academicTermId?: string,
    @Query('status') status?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.findAll(tenantId, { academicTermId, status });
  }

  @Get(':id')
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({
    summary: 'Get a timetable (lazily reconciles GENERATING via job state)',
  })
  @ApiOkResponse({ description: 'Timetable retrieved.' })
  @ApiNotFoundResponse({ description: 'Timetable not found.' })
  async findOne(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.findOne(tenantId, id);
  }

  @Get(':id/slots')
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: "Get a timetable's slots" })
  @ApiOkResponse({ description: 'Slots retrieved.' })
  async findSlots(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.findSlots(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // Preflight + generate
  // ---------------------------------------------------------------------------

  @Post('preflight')
  @RequirePermissions(PERMS.timetable.generate)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dry-run generation checks (no job is queued)' })
  @ApiOkResponse({ description: 'Preflight issues returned.' })
  async preflight(
    @GetCurrentTenant('id') tenantId: string,
    @Body() dto: PreflightTimetableDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.preflight(tenantId, dto);
  }

  @Post('generate')
  @RequirePermissions(PERMS.timetable.generate)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start timetable generation (async)' })
  @ApiAcceptedResponse({
    description: 'Generation started; poll the timetable.',
  })
  @ApiUnprocessableEntityResponse({
    description: 'Preflight errors block generation.',
  })
  async generate(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: GenerateTimetableDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.generate(tenantId, userId, dto);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  @Post(':id/duplicate')
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Duplicate a timetable as a new draft version' })
  @ApiConflictResponse({ description: 'Source is still generating.' })
  async duplicate(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DuplicateTimetableDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.duplicate(tenantId, id, userId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMS.timetable.manage)
  @ApiOperation({ summary: 'Rename a timetable' })
  @ApiOkResponse({ description: 'Timetable renamed.' })
  async rename(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameTimetableDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.rename(tenantId, id, userId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (soft) a timetable version' })
  @ApiConflictResponse({
    description: 'Published timetables cannot be deleted.',
  })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.remove(tenantId, id, userId);
  }

  @Post(':id/publish')
  @RequirePermissions(PERMS.timetable.publish)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish a draft (or archived — rollback) timetable version',
  })
  @ApiOkResponse({ description: 'Timetable published; may carry warnings.' })
  @ApiConflictResponse({
    description: 'Only DRAFT or ARCHIVED can be published.',
  })
  async publish(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.timetablesService.publish(tenantId, id, userId);
  }

  // ---------------------------------------------------------------------------
  // Draft editor (move / swap / delete slots)
  // ---------------------------------------------------------------------------

  @Patch(':id/slots/:slotId')
  @RequirePermissions(PERMS.timetable.manage)
  @ApiOperation({ summary: 'Move a slot to another cell (DRAFT only)' })
  @ApiOkResponse({ description: 'Slot moved.' })
  @ApiConflictResponse({
    description: 'Structured conflicts: { conflicts: [{ code, message }] }.',
  })
  async moveSlot(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Body() dto: MoveSlotDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.editorService.moveSlot(tenantId, id, slotId, dto);
  }

  @Post(':id/slots/swap')
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Swap two slots (DRAFT only)' })
  @ApiOkResponse({ description: 'Slots swapped.' })
  @ApiConflictResponse({
    description: 'Structured conflicts: { conflicts: [{ code, message }] }.',
  })
  async swapSlots(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SwapSlotsDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.editorService.swapSlots(tenantId, id, dto);
  }

  @Delete(':id/slots/:slotId')
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a slot (DRAFT only)' })
  @ApiOkResponse({ description: 'Slot removed.' })
  async deleteSlot(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.editorService.deleteSlot(tenantId, id, slotId);
  }
}
