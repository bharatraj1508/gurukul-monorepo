import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
  GetCurrentUserId,
  RequirePermissions,
} from '../common/decorators';
import { AttendanceService } from './attendance.service';
import { LoadAttendanceSheetDto, SaveAttendanceDto } from './dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('classes/:classId/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ---------------------------------------------------------------------------
  // GET /classes/:classId/attendance?date=YYYY-MM-DD
  // ---------------------------------------------------------------------------
  @Get()
  @RequirePermissions(PERMS.attendance.view)
  @ApiOperation({
    summary: 'Load attendance sheet',
    description:
      'Returns the attendance sheet for a class on a specific date. ' +
      'Includes all active enrolments with existing attendance records if already marked.',
  })
  @ApiQuery({
    name: 'date',
    required: true,
    type: String,
    example: '2026-07-17',
    description: 'Attendance date in YYYY-MM-DD format',
  })
  @ApiOkResponse({ description: 'Attendance sheet loaded successfully.' })
  @ApiNotFoundResponse({ description: 'Class not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async loadAttendanceSheet(
    @GetCurrentTenant('id') tenantId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Query() dto: LoadAttendanceSheetDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.attendanceService.loadAttendanceSheet(tenantId, classId, dto);
  }

  // ---------------------------------------------------------------------------
  // POST /classes/:classId/attendance
  // ---------------------------------------------------------------------------
  @Post()
  @RequirePermissions(PERMS.attendance.mark)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk save attendance',
    description:
      'Saves attendance for the entire class in a single request — the way a teacher marks attendance. ' +
      'Creates new records and updates existing ones. Runs in a transaction: all succeed or all fail.',
  })
  @ApiOkResponse({ description: 'Attendance saved successfully.' })
  @ApiNotFoundResponse({ description: 'Class not found.' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions.' })
  async saveAttendance(
    @GetCurrentTenant('id') tenantId: string,
    @GetCurrentUserId() userId: string,
    @Param('classId', ParseUUIDPipe) classId: string,
    @Body() dto: SaveAttendanceDto,
  ) {
    if (!tenantId) throw new ForbiddenException('Tenant context required.');
    return this.attendanceService.saveAttendance(
      tenantId,
      classId,
      userId,
      dto,
    );
  }
}
