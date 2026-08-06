import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from 'nestjs-prisma';

import { LoadAttendanceSheetDto, SaveAttendanceDto } from './dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // LOAD — attendance sheet for one class on one date
  // ---------------------------------------------------------------------------
  async loadAttendanceSheet(
    tenantId: string,
    classId: string,
    dto: LoadAttendanceSheetDto,
  ) {
    // 1. Verify class exists and belongs to this tenant
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!cls) {
      throw new NotFoundException('Class not found in this tenant.');
    }

    // 2. Parse and validate date
    const attendanceDate = this.parseDate(dto.date);

    // 3. Load enrolments for this class that were active on the target date.
    //    A student who enrolled before the date and later withdrew was still
    //    present on that day — exclude only hard-deleted records and enrolments
    //    that started AFTER the target date.
    const enrolments = await this.prisma.enrolment.findMany({
      where: {
        classId,
        tenantId,
        deletedAt: null,
        enrolledAt: { lte: attendanceDate },
      },
      include: {
        student: {
          select: {
            id: true,
            rollNumber: true,
            membership: {
              select: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        attendanceRecords: {
          where: {
            date: attendanceDate,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
            remark: true,
          },
        },
      },
      orderBy: [
        {
          student: {
            rollNumber: 'asc',
          },
        },
      ],
    });

    // 4. Shape the response
    const sheet = enrolments.map((e) => {
      const user = e.student?.membership?.user ?? null;
      const existingRecord = e.attendanceRecords[0] ?? null;

      return {
        enrolmentId: e.id,
        studentProfileId: e.student.id,
        rollNumber: e.student.rollNumber,
        name: user ? `${user.firstName} ${user.lastName}` : null,
        attendance: existingRecord
          ? {
              id: existingRecord.id,
              status: existingRecord.status,
              remark: existingRecord.remark ?? null,
            }
          : null,
      };
    });

    return {
      classId: cls.id,
      className: cls.name,
      date: dto.date,
      totalStudents: sheet.length,
      sheet,
    };
  }

  // ---------------------------------------------------------------------------
  // SAVE — bulk upsert attendance for an entire class on one date
  // ---------------------------------------------------------------------------
  async saveAttendance(
    tenantId: string,
    classId: string,
    userId: string,
    dto: SaveAttendanceDto,
  ) {
    // 1. Verify class exists and belongs to this tenant
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!cls) {
      throw new NotFoundException('Class not found in this tenant.');
    }

    // 2. Parse and validate date
    const attendanceDate = this.parseDate(dto.date);

    // 3. Reject duplicate enrolmentIds within the same request
    const enrolmentIds = dto.records.map((r) => r.enrolmentId);
    const uniqueEnrolmentIds = new Set(enrolmentIds);
    if (uniqueEnrolmentIds.size !== enrolmentIds.length) {
      throw new BadRequestException(
        'Duplicate enrolment IDs found in the request. Each student can appear only once.',
      );
    }

    // 4. Verify all enrolmentIds are enrolments that were valid on the target date.
    //    Historical integrity: a student who withdrew after the target date is still
    //    eligible to have attendance recorded for that date.
    const validEnrolments = await this.prisma.enrolment.findMany({
      where: {
        id: { in: enrolmentIds },
        classId,
        tenantId,
        deletedAt: null,
        enrolledAt: { lte: attendanceDate },
      },
      select: { id: true },
    });

    if (validEnrolments.length !== enrolmentIds.length) {
      const validIds = new Set(validEnrolments.map((e) => e.id));
      const invalidIds = enrolmentIds.filter((id) => !validIds.has(id));
      throw new BadRequestException(
        `The following enrolment IDs are invalid, not enrolled on this date, or do not belong to this class: ${invalidIds.join(', ')}`,
      );
    }

    // 5. Execute all upserts within a single transaction
    //    Either every record saves, or the entire batch rolls back.
    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.records) {
        await tx.attendanceRecord.upsert({
          where: {
            enrolmentId_date: {
              enrolmentId: entry.enrolmentId,
              date: attendanceDate,
            },
          },
          create: {
            tenantId,
            enrolmentId: entry.enrolmentId,
            date: attendanceDate,
            status: entry.status,
            remark: entry.remark ?? null,
            createdBy: userId,
            updatedBy: userId,
          },
          update: {
            status: entry.status,
            remark: entry.remark ?? null,
            updatedBy: userId,
          },
        });
      }
    });

    this.logger.log(
      JSON.stringify({
        action: 'SAVE_ATTENDANCE',
        classId,
        tenantId,
        date: dto.date,
        actorUserId: userId,
        recordCount: dto.records.length,
        timestamp: new Date().toISOString(),
      }),
    );

    return {
      message: 'Attendance saved successfully.',
      classId,
      date: dto.date,
      savedCount: dto.records.length,
    };
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Parses a YYYY-MM-DD date string into a Date set to midnight UTC.
   *
   * Two-stage validation:
   *   1. Reject strings that produce NaN (non-date garbage).
   *   2. Reject calendar overflow: JavaScript silently normalises impossible
   *      dates (e.g. "2026-02-31" → March 3rd). We compare the UTC components
   *      of the parsed result back against the original input; a mismatch means
   *      the input day did not exist in that month/year.
   */
  private parseDate(dateString: string): Date {
    const parsed = new Date(`${dateString}T00:00:00.000Z`);
    if (isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `Invalid date "${dateString}". Expected format: YYYY-MM-DD.`,
      );
    }

    const parts = dateString.split('-');
    const inputYear = Number(parts[0]);
    const inputMonth = Number(parts[1]);
    const inputDay = Number(parts[2]);

    if (
      parsed.getUTCFullYear() !== inputYear ||
      parsed.getUTCMonth() + 1 !== inputMonth ||
      parsed.getUTCDate() !== inputDay
    ) {
      throw new BadRequestException(
        `Invalid date "${dateString}": the day does not exist in that month.`,
      );
    }

    return parsed;
  }
}
