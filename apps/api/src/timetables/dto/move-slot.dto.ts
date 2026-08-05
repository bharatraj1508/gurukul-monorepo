import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class MoveSlotDto {
  @ApiProperty({ description: 'Target ISO weekday (1=Monday .. 7=Sunday).' })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @ApiProperty({ description: 'Target period number.' })
  @IsInt()
  @Min(1)
  periodNumber: number;

  @ApiPropertyOptional({
    description:
      'New room. Omit to keep the current room; pass null to clear it.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((o: MoveSlotDto) => o.roomId !== null)
  @IsUUID()
  roomId?: string | null;
}
