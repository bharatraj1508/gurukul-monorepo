import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Methodology } from './create-lesson-plan.dto';

export class UpdateLessonPlanItemDto {
  @ApiPropertyOptional({ description: 'Item ID to update (omit to create a new item)' })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: 'Syllabus topic UUID' })
  @IsUUID()
  @IsOptional()
  syllabusTopicId?: string;

  @ApiPropertyOptional({ description: 'Estimated teaching hours' })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(100)
  @IsOptional()
  estimatedHours?: number;

  @ApiPropertyOptional({ enum: Methodology })
  @IsEnum(Methodology)
  @IsOptional()
  methodology?: Methodology;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  resources?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  learningOutcomes?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}

export class UpdateLessonPlanDto {
  @ApiPropertyOptional({ description: 'Plan start date' })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Plan end date' })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Week number' })
  @IsInt()
  @Min(1)
  @Max(60)
  @IsOptional()
  weekNumber?: number;

  @ApiPropertyOptional({ description: 'Month (1–12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;

  @ApiPropertyOptional({ description: 'Replaces all items (full replacement)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateLessonPlanItemDto)
  @IsOptional()
  items?: UpdateLessonPlanItemDto[];
}
