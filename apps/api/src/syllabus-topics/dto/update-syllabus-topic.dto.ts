import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSyllabusTopicDto {
  @ApiPropertyOptional({ description: 'Topic title', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: 'Parent topic ID (null to make top-level)' })
  @IsUUID()
  @IsOptional()
  parentId?: string | null;

  @ApiPropertyOptional({ description: 'Display order index' })
  @IsInt()
  @Min(0)
  @Max(9999)
  @IsOptional()
  orderIndex?: number;
}
