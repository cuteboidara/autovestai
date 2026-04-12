import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateAdminMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  content!: string;
}
