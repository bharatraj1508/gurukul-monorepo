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
  GetCurrentUserId,
  RequirePermissions,
} from '../common/decorators';
import { CreateAnnouncementDto, RejectAnnouncementDto, UpdateAnnouncementDto } from './dto';
import { AnnouncementsService } from './announcements.service';

@ApiTags('Announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  @RequirePermissions(PERMS.announcement.create)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a school-wide announcement' })
  @ApiCreatedResponse({ description: 'Announcement created successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Body() dto: CreateAnnouncementDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.announcementsService.create(tenantId, userId, dto, user?.isAdmin ?? false);
  }

  @Get()
  @RequirePermissions(PERMS.announcement.view)
  @ApiOperation({ summary: 'List announcements' })
  @ApiQuery({ name: 'status', required: false, description: 'PENDING_APPROVAL | APPROVED | REJECTED' })
  @ApiQuery({ name: 'active', required: false, description: 'Default true. Pass false to include expired.' })
  @ApiOkResponse({ description: 'Announcements retrieved.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Query('status') status?: string,
    @Query('active') active?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.announcementsService.findAll(tenantId, userId, user?.isAdmin ?? false, {
      status,
      active,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMS.announcement.view)
  @ApiOperation({ summary: 'Get a single announcement' })
  @ApiOkResponse({ description: 'Announcement retrieved.' })
  @ApiNotFoundResponse({ description: 'Announcement not found.' })
  async findOne(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.announcementsService.findOne(tenantId, id);
  }

  @Patch(':id/approve')
  @RequirePermissions(PERMS.announcement.approve)
  @ApiOperation({ summary: 'Approve a pending announcement (Principal/Admin only)' })
  @ApiOkResponse({ description: 'Announcement approved and published.' })
  async approve(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.announcementsService.approve(tenantId, id, userId, user?.isAdmin ?? false);
  }

  @Patch(':id/reject')
  @RequirePermissions(PERMS.announcement.approve)
  @ApiOperation({ summary: 'Reject a pending announcement with feedback (Principal/Admin only)' })
  @ApiOkResponse({ description: 'Announcement rejected.' })
  async reject(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectAnnouncementDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.announcementsService.reject(tenantId, id, userId, dto, user?.isAdmin ?? false);
  }

  @Patch(':id')
  @RequirePermissions(PERMS.announcement.editOwn)
  @ApiOperation({ summary: 'Update an announcement' })
  @ApiOkResponse({ description: 'Announcement updated.' })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnouncementDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.announcementsService.update(tenantId, id, userId, dto, user?.isAdmin ?? false);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.announcement.deleteOwn)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (soft) an announcement' })
  @ApiOkResponse({ description: 'Announcement deleted.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.announcementsService.remove(tenantId, id, userId, user?.isAdmin ?? false);
  }
}
