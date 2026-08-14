import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CloneLessonPlanDto {
  @ApiProperty({ description: 'Target class UUID to clone the plan into' })
  @IsUUID()
  classId: string;

  @ApiProperty({ description: 'Target academic term UUID' })
  @IsUUID()
  academicTermId: string;

  @ApiPropertyOptional({ description: 'Optional label override for the cloned plan' })
  @IsString()
  @IsOptional()
  note?: string;
}
