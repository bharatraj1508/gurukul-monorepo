import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectAnnouncementDto {
  @ApiProperty({ description: 'Feedback or reason for rejecting the announcement', maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejectionReason: string;
}
