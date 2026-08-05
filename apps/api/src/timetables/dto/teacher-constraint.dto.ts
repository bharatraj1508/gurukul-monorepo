import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsInt, IsObject, IsOptional, Min } from 'class-validator';

export class UpsertTeacherConstraintDto {
  @ApiPropertyOptional({
    description: 'Max teaching periods per day.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPeriodsPerDay?: number | null;

  @ApiPropertyOptional({
    description: 'Max teaching periods per week.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxPeriodsPerWeek?: number | null;

  @ApiPropertyOptional({
    description: 'Max consecutive teaching periods.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxConsecutivePeriods?: number | null;

  @ApiPropertyOptional({
    description:
      'Allowed period numbers per ISO weekday, e.g. {"1":[1,2,3,8]}. Omit/null = fully available.',
    example: { '1': [1, 2, 3, 8] },
  })
  @IsOptional()
  @IsObject()
  availability?: Record<string, number[]> | null;
}
