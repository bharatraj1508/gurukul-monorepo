import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class PreflightTimetableDto {
  @ApiProperty({ description: 'Academic term to schedule.' })
  @IsUUID()
  academicTermId: string;

  @ApiProperty({ description: 'Period template defining the weekly grid.' })
  @IsUUID()
  periodTemplateId: string;
}

export class GenerateTimetableDto extends PreflightTimetableDto {
  @ApiPropertyOptional({
    description: 'Version name. Defaults to "Timetable v{n}".',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({
    description:
      'Solver wall-time budget in seconds. Clamped to the server-side cap.',
    minimum: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  timeLimitSeconds?: number;
}
