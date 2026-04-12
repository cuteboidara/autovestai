import { NoteType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateClientNoteDto {
  @IsOptional()
  @IsEnum(NoteType)
  noteType?: NoteType;

  @IsString()
  @MinLength(3)
  @MaxLength(10_000)
  content!: string;
}
