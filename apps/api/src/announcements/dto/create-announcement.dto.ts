import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ description: 'Announcement title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Rich text HTML content' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({
    description:
      'If true, announcement is set to active immediately upon approval (startDate = now). ' +
      'If false, startDate must be provided.',
  })
  @IsBoolean()
  sendImmediately: boolean;

  @ApiPropertyOptional({
    description: 'ISO date-time for scheduled start. Required if sendImmediately = false.',
  })
  @IsDateString()
  @IsOptional()
  @ValidateIf((o: CreateAnnouncementDto) => !o.sendImmediately)
  startDate?: string;

  @ApiProperty({ description: 'ISO date-time when announcement expires.' })
  @IsDateString()
  endDate: string;
}
