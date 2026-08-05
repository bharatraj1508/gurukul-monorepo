import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class DuplicateTimetableDto {
  @ApiPropertyOptional({
    description: 'Name for the copy. Defaults to "{source name} (copy)".',
    maxLength: 150,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;
}
