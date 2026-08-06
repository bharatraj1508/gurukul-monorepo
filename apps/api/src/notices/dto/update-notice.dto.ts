import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { NOTICE_SCOPES, type NoticeScope } from './create-notice.dto';

export class UpdateNoticeDto {
  @ApiPropertyOptional({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  content?: string;

  @ApiPropertyOptional({ enum: NOTICE_SCOPES })
  @IsIn(NOTICE_SCOPES)
  @IsOptional()
  scope?: NoticeScope;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  @IsOptional()
  classIds?: string[];
}
