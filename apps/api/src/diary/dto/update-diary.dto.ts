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

// Term/program/class are fixed at creation; only the note payload is editable.
export class UpdateDiaryDto {
  // Optional so an omitted note is a no-op, but never blankable: IsNotEmpty
  // rejects "" and the trim transform rejects whitespace-only notes too.
  @ApiProperty({
    required: false,
    maxLength: DIARY_NOTE_MAX_LENGTH,
    description: `The diary note text (max ${DIARY_NOTE_MAX_LENGTH} characters)`,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(DIARY_NOTE_MAX_LENGTH)
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
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
    maxItems: DIARY_STUDENT_IDS_MAX_SIZE,
    description:
      'Target student profile UUIDs. Empty ⇒ all students of the class.',
  })
  @IsArray()
  @ArrayMaxSize(DIARY_STUDENT_IDS_MAX_SIZE)
  @IsUUID(undefined, { each: true })
  @IsOptional()
  studentIds?: string[];
}
