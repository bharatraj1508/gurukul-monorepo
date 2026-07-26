import { ApiProperty } from '@nestjs/swagger';

import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

// Term/program/class are fixed at creation; only the note payload is editable.
export class UpdateDiaryDto {
  @ApiProperty({ required: false, description: 'The diary note text' })
  @IsString()
  @IsOptional()
  note?: string;

  @ApiProperty({
    required: false,
    description: 'Optional course UUID — set for a course-specific note',
  })
  @IsUUID()
  @IsOptional()
  courseId?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description:
      'Target student profile UUIDs. Empty ⇒ all students of the class.',
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  @IsOptional()
  studentIds?: string[];
}
