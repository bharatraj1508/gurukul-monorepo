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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PERMS } from '@repo/permissions';
import {
  GetCurrentTenant,
  RequirePermissions,
} from '../common/decorators';
import { CreateSyllabusTopicDto, UpdateSyllabusTopicDto } from './dto';
import { SyllabusTopicsService } from './syllabus-topics.service';

@ApiTags('Syllabus Topics')
@ApiBearerAuth()
@Controller('courses/:courseId/syllabus-topics')
export class SyllabusTopicsController {
  constructor(private readonly syllabusTopicsService: SyllabusTopicsService) {}

  @Get()
  @RequirePermissions(PERMS.course.viewOwn)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List syllabus topics for a course' })
  @ApiOkResponse({ description: 'Topics retrieved.' })
  async findAll(
    @GetCurrentTenant('id') tenantId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.syllabusTopicsService.findByCourse(tenantId, courseId);
  }

  @Post()
  @RequirePermissions(PERMS.course.edit)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a syllabus topic for a course' })
  @ApiCreatedResponse({ description: 'Topic created.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async create(
    @GetCurrentTenant('id') tenantId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateSyllabusTopicDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.syllabusTopicsService.create(tenantId, courseId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMS.course.edit)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a syllabus topic' })
  @ApiOkResponse({ description: 'Topic updated.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async update(
    @GetCurrentTenant('id') tenantId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSyllabusTopicDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.syllabusTopicsService.update(tenantId, courseId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMS.course.edit)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a syllabus topic (soft)' })
  @ApiOkResponse({ description: 'Topic deleted.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async remove(
    @GetCurrentTenant('id') tenantId: string,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.syllabusTopicsService.remove(tenantId, courseId, id);
  }
}
