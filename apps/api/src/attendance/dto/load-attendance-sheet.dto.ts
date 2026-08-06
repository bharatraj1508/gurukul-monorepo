import { ApiProperty } from '@nestjs/swagger';

import { IsDateString, IsNotEmpty } from 'class-validator';

export class LoadAttendanceSheetDto {
  @ApiProperty({
    example: '2026-07-17',
    description: 'Attendance date in YYYY-MM-DD format',
  })
  @IsDateString()
  @IsNotEmpty()
  date: string;
}
