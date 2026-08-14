import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TopicCommentDto {
  @ApiProperty({ description: 'Lesson plan item ID' })
  @IsUUID()
  itemId: string;

  @ApiProperty({ description: 'Inline comment for this topic' })
  @IsString()
  @IsNotEmpty()
  comment: string;
}

export class ReviewLessonPlanDto {
  @ApiPropertyOptional({ description: 'General feedback remarks for the entire plan' })
  @IsString()
  @IsOptional()
  generalRemarks?: string;

  @ApiPropertyOptional({
    type: [TopicCommentDto],
    description: 'Per-topic inline comments (only for revision requests)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TopicCommentDto)
  @IsOptional()
  topicComments?: TopicCommentDto[];
}
