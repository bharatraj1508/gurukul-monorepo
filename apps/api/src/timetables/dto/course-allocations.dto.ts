import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { ROOM_TYPE } from '../timetables.constants';

const ROOM_TYPES = Object.values(ROOM_TYPE);

export class CourseAllocationItemDto {
  @ApiProperty({ description: 'Course to allocate.' })
  @IsUUID()
  courseId: string;

  @ApiProperty({
    description: 'Teaching periods per week.',
    minimum: 1,
    maximum: 60,
  })
  @IsInt()
  @Min(1)
  @Max(60)
  periodsPerWeek: number;

  @ApiPropertyOptional({
    description:
      'Sessions are scheduled in consecutive blocks of this size (must divide periodsPerWeek).',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  consecutiveBlockSize?: number;

  @ApiPropertyOptional({
    description: 'Pinned room. Mutually exclusive with roomType.',
  })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({
    description: 'Any room of this type. Mutually exclusive with roomId.',
    enum: ROOM_TYPES,
  })
  @IsOptional()
  @IsIn(ROOM_TYPES)
  roomType?: string;
}

export class BulkCourseAllocationsDto {
  @ApiProperty({
    description:
      'Full allocation set for the class. Existing allocations not listed here are removed.',
    type: [CourseAllocationItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseAllocationItemDto)
  allocations: CourseAllocationItemDto[];
}
