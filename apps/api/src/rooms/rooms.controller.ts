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
} from '../common/decorators';
import { CreateRoomDto, UpdateRoomDto } from './dto';
import { RoomsService } from './rooms.service';

@ApiTags('Rooms')
@ApiBearerAuth()
@Controller('rooms')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a room' })
  @ApiCreatedResponse({ description: 'Room created.' })
  @ApiConflictResponse({ description: 'A room with this name already exists.' })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Body() dto: CreateRoomDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.roomsService.create(tenantId, userId, dto);
  }

  @Get()
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: 'List rooms' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiOkResponse({ description: 'Rooms retrieved.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.roomsService.findAll(tenantId, search, type);
  }

  @Get(':id')
  @RequirePermissions(PERMS.timetable.view)
  @ApiOperation({ summary: 'Get a single room' })
  @ApiOkResponse({ description: 'Room retrieved.' })
  @ApiNotFoundResponse({ description: 'Room not found.' })
  async findOne(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.roomsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMS.timetable.manage)
  @ApiOperation({ summary: 'Update a room' })
  @ApiOkResponse({ description: 'Room updated.' })
  @ApiConflictResponse({ description: 'A room with this name already exists.' })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoomDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.roomsService.update(tenantId, id, userId, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.timetable.manage)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (soft) a room' })
  @ApiOkResponse({ description: 'Room deleted.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.roomsService.remove(tenantId, id, userId);
  }
}
