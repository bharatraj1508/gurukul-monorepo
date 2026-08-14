import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSyllabusTopicDto {
  @ApiProperty({ description: 'Topic title', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    description: 'Parent topic ID for sub-topics. Omit for top-level topics.',
  })
  @IsUUID()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Display order index', default: 0 })
  @IsInt()
  @Min(0)
  @Max(9999)
  @IsOptional()
  orderIndex?: number;
}
