import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const NOTICE_SCOPES = ['CLASS', 'TEACHERS_ONLY', 'SCHOOL_WIDE'] as const;
export type NoticeScope = (typeof NOTICE_SCOPES)[number];

export class CreateNoticeDto {
  @ApiProperty({ description: 'Notice title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Rich text HTML content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description: 'Scope of notice: CLASS | TEACHERS_ONLY | SCHOOL_WIDE',
    enum: NOTICE_SCOPES,
  })
  @IsIn(NOTICE_SCOPES)
  scope: NoticeScope;

  @ApiProperty({
    description:
      'If true, notice is published immediately (startDate = now). ' +
      'If false, startDate must be provided.',
  })
  @IsBoolean()
  sendImmediately: boolean;

  @ApiPropertyOptional({
    description: 'ISO date-time for scheduled publish. Required if sendImmediately = false.',
  })
  @IsDateString()
  @IsOptional()
  @ValidateIf((o: CreateNoticeDto) => !o.sendImmediately)
  startDate?: string;

  @ApiProperty({ description: 'ISO date-time when notice expires.' })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    description: 'Target class IDs. Required when scope = CLASS.',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  @ValidateIf((o: CreateNoticeDto) => o.scope === 'CLASS')
  classIds?: string[];
}
