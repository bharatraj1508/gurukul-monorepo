import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import {
  DIARY_NOTE_MAX_LENGTH,
  DIARY_STUDENT_IDS_MAX_SIZE,
} from '../diary.constants';

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

  @ApiProperty({
    maxLength: DIARY_NOTE_MAX_LENGTH,
    description: `The diary note text (max ${DIARY_NOTE_MAX_LENGTH} characters)`,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(DIARY_NOTE_MAX_LENGTH)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  note: string;

  @ApiProperty({
    required: false,
    type: [String],
    maxItems: DIARY_STUDENT_IDS_MAX_SIZE,
    description:
      'Target student profile UUIDs for a student-specific note. Empty/omitted ⇒ all students of the class.',
  })
  @IsArray()
  @ArrayMaxSize(DIARY_STUDENT_IDS_MAX_SIZE)
  @IsUUID(undefined, { each: true })
  @IsOptional()
  studentIds?: string[];
}
