import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { ISO_DATE_REGEX } from '../timetables.util';

export class CreateSubstitutionDto {
  @ApiProperty({
    description: 'Slot (in the published timetable) being covered.',
  })
  @IsUUID()
  timetableSlotId: string;

  @ApiProperty({ description: 'Date of the substitution (YYYY-MM-DD).' })
  @Matches(ISO_DATE_REGEX, { message: 'date must be formatted as YYYY-MM-DD.' })
  date: string;

  @ApiProperty({ description: 'Membership id of the substitute teacher.' })
  @IsUUID()
  substituteTeacherMembershipId: string;

  @ApiPropertyOptional({
    description: 'Reason for the substitution.',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason?: string;
}

export class UpdateSubstitutionDto extends PartialType(CreateSubstitutionDto) {}
