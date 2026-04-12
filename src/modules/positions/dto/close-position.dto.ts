import { IsString, MaxLength } from 'class-validator';

export class ClosePositionDto {
  @IsString()
  @MaxLength(64)
  positionId!: string;
}
