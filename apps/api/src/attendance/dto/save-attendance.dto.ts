import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';

import { AttendanceEntryDto } from './attendance-entry.dto';

export class SaveAttendanceDto {
  @ApiProperty({
    example: '2026-07-17',
    description: 'Attendance date in YYYY-MM-DD format',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    type: [AttendanceEntryDto],
    description:
      'Attendance entries for every student in the class. One entry per enrolled student.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  records: AttendanceEntryDto[];
}
