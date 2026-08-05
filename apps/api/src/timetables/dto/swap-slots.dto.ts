import { ApiProperty } from '@nestjs/swagger';

import { IsUUID } from 'class-validator';

export class SwapSlotsDto {
  @ApiProperty({ description: 'First slot to swap.' })
  @IsUUID()
  slotAId: string;

  @ApiProperty({ description: 'Second slot to swap.' })
  @IsUUID()
  slotBId: string;
}
