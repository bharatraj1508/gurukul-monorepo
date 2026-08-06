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
import { CreateNoticeDto, UpdateNoticeDto } from './dto';
import { NoticesService } from './notices.service';

@ApiTags('Notices')
@ApiBearerAuth()
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @RequirePermissions(PERMS.notice.createClass)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a notice' })
  @ApiCreatedResponse({ description: 'Notice created successfully.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Body() dto: CreateNoticeDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.noticesService.create(tenantId, userId, dto, user?.isAdmin ?? false);
  }

  @Get()
  @RequirePermissions(PERMS.notice.view)
  @ApiOperation({ summary: 'List notices (role-aware)' })
  @ApiQuery({ name: 'scope', required: false })
  @ApiQuery({ name: 'classId', required: false })
  @ApiQuery({ name: 'active', required: false, description: 'Default true. Pass false to include expired.' })
  @ApiOkResponse({ description: 'Notices retrieved.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Query('scope') scope?: string,
    @Query('classId') classId?: string,
    @Query('active') active?: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.noticesService.findAll(tenantId, userId, user?.isAdmin ?? false, {
      scope,
      classId,
      active,
    });
  }

  @Get(':id')
  @RequirePermissions(PERMS.notice.view)
  @ApiOperation({ summary: 'Get a single notice' })
  @ApiOkResponse({ description: 'Notice retrieved.' })
  @ApiNotFoundResponse({ description: 'Notice not found.' })
  async findOne(
    @GetCurrentTenant('id') tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.noticesService.findOne(tenantId, id);
  }

  @Patch(':id')
  @RequirePermissions(PERMS.notice.editOwn)
  @ApiOperation({ summary: 'Update a notice' })
  @ApiOkResponse({ description: 'Notice updated.' })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNoticeDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.noticesService.update(tenantId, id, userId, dto, user?.isAdmin ?? false);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.notice.deleteOwn)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (soft) a notice' })
  @ApiOkResponse({ description: 'Notice deleted.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @GetCurrentUser() user: { isAdmin?: boolean },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.noticesService.remove(tenantId, id, userId, user?.isAdmin ?? false);
  }
}
