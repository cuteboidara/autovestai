import { NoteType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateClientNoteDto {
  @IsOptional()
  @IsEnum(NoteType)
  noteType?: NoteType;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(10_000)
  content?: string;
}
