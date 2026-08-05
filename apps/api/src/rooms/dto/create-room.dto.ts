import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { ROOM_TYPE } from '../../timetables/timetables.constants';

const ROOM_TYPES = Object.values(ROOM_TYPE);

export class CreateRoomDto {
  @ApiProperty({ description: 'Room name (unique per school)', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Room type',
    enum: ROOM_TYPES,
    default: ROOM_TYPE.CLASSROOM,
  })
  @IsOptional()
  @IsIn(ROOM_TYPES)
  type?: string;

  @ApiProperty({ description: 'Seating capacity', minimum: 1 })
  @IsInt()
  @Min(1)
  capacity: number;
}
