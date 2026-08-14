import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum PlanType {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum Methodology {
  LECTURE = 'Lecture',
  LAB = 'Lab',
  GROUP_ACTIVITY = 'Group Activity',
  PRESENTATION = 'Presentation',
  DISCUSSION = 'Discussion',
  PROJECT = 'Project',
  DEMONSTRATION = 'Demonstration',
  FIELD_TRIP = 'Field Trip',
  SELF_STUDY = 'Self Study',
}

export class CreateLessonPlanItemDto {
  @ApiProperty({ description: 'Syllabus topic UUID' })
  @IsUUID()
  syllabusTopicId: string;

  @ApiProperty({ description: 'Estimated teaching hours', example: 2.5 })
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0.5)
  @Max(100)
  estimatedHours: number;

  @ApiProperty({ enum: Methodology, description: 'Teaching methodology' })
  @IsEnum(Methodology)
  methodology: Methodology;

  @ApiPropertyOptional({ description: 'Resources / materials needed' })
  @IsString()
  @IsOptional()
  resources?: string;

  @ApiPropertyOptional({ description: 'Expected learning outcomes' })
  @IsString()
  @IsOptional()
  learningOutcomes?: string;

  @ApiPropertyOptional({ description: 'Display order within the plan' })
  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}

export class CreateLessonPlanDto {
  @ApiProperty({ description: 'Class UUID' })
  @IsUUID()
  classId: string;

  @ApiProperty({ description: 'Course (subject) UUID' })
  @IsUUID()
  courseId: string;

  @ApiProperty({ description: 'Academic term UUID' })
  @IsUUID()
  academicTermId: string;

  @ApiProperty({ enum: PlanType, description: 'Weekly or Monthly plan' })
  @IsEnum(PlanType)
  planType: PlanType;

  @ApiPropertyOptional({ description: 'Week number within the term (required for WEEKLY plans)' })
  @IsInt()
  @Min(1)
  @Max(60)
  @ValidateIf((o: CreateLessonPlanDto) => o.planType === PlanType.WEEKLY)
  @IsNotEmpty()
  weekNumber?: number;

  @ApiPropertyOptional({ description: 'Month (1–12, required for MONTHLY plans)' })
  @IsInt()
  @Min(1)
  @Max(12)
  @ValidateIf((o: CreateLessonPlanDto) => o.planType === PlanType.MONTHLY)
  @IsNotEmpty()
  month?: number;

  @ApiProperty({ description: 'Calendar year', example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ description: 'Plan start date (ISO date)', example: '2026-08-04' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Plan end date (ISO date)', example: '2026-08-08' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'If true, plan is immediately submitted for review instead of saved as draft.',
    default: false,
  })
  @IsOptional()
  submitImmediately?: boolean;

  @ApiProperty({ type: [CreateLessonPlanItemDto], description: 'Topic items for this plan' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLessonPlanItemDto)
  items: CreateLessonPlanItemDto[];
}
