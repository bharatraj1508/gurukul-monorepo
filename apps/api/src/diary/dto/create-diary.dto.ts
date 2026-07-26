import { ApiProperty } from '@nestjs/swagger';

import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateDiaryDto {
  @ApiProperty({ description: 'The UUID of the academic term' })
  @IsUUID()
  @IsNotEmpty()
  termId: string;

  @ApiProperty({ description: 'The UUID of the program' })
  @IsUUID()
  @IsNotEmpty()
  programId: string;

  @ApiProperty({ description: 'The UUID of the class/section' })
  @IsUUID()
  @IsNotEmpty()
  classId: string;

  @ApiProperty({
    required: false,
    description: 'Optional course UUID — set for a course-specific note',
  })
  @IsUUID()
  @IsOptional()
  courseId?: string;

  @ApiProperty({ description: 'The diary note text' })
  @IsString()
  @IsNotEmpty()
  note: string;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Target student profile UUIDs for a student-specific note. Empty/omitted ⇒ all students of the class.',
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  studentIds?: string[];
}
