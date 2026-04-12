import { IsString, MaxLength } from 'class-validator';

export class UnfollowCopyMasterDto {
  @IsString()
  @MaxLength(64)
  followId!: string;
}
