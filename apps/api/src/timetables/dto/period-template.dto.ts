import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PERIOD_SLOT_KIND } from '../timetables.constants';
import { HHMM_REGEX } from '../timetables.util';

const SLOT_KINDS = Object.values(PERIOD_SLOT_KIND);

export class PeriodTemplateSlotDto {
  @ApiProperty({ description: 'Slot kind', enum: SLOT_KINDS })
  @IsIn(SLOT_KINDS)
  kind: string;

  @ApiPropertyOptional({ description: 'Display label (e.g. "Lunch Break")' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @ApiProperty({ description: 'Start time "HH:mm"', example: '08:00' })
  @Matches(HHMM_REGEX, { message: 'startTime must be formatted as HH:mm.' })
  startTime: string;

  @ApiProperty({ description: 'End time "HH:mm"', example: '08:45' })
  @Matches(HHMM_REGEX, { message: 'endTime must be formatted as HH:mm.' })
  endTime: string;

  @ApiPropertyOptional({
    description:
      'Period number (required for PERIOD slots, forbidden otherwise).',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  periodNumber?: number;
}

export class CreatePeriodTemplateDto {
  @ApiProperty({
    description: 'Template name (unique per school)',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description: 'ISO weekdays school runs (1=Monday .. 7=Sunday).',
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  workingDays: number[];

  @ApiProperty({
    description: 'Day structure in chronological order.',
    type: [PeriodTemplateSlotDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PeriodTemplateSlotDto)
  slots: PeriodTemplateSlotDto[];
}

export class UpdatePeriodTemplateDto extends PartialType(
  CreatePeriodTemplateDto,
) {}
