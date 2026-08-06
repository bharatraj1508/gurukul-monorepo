import { ApiProperty } from '@nestjs/swagger';

import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  LEAVE = 'LEAVE',
}

export class AttendanceEntryDto {
  @ApiProperty({
    example: 'a1b2c3d4-...',
    description: 'UUID of the enrolment record',
  })
  @IsUUID()
  @IsNotEmpty()
  enrolmentId: string;

  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
    description: 'Attendance status: PRESENT, ABSENT, or LEAVE',
  })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @ApiProperty({
    example: 'Sick leave',
    required: false,
    description: 'Optional remark for this attendance entry',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  remark?: string;
}
