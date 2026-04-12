import { IsString, MaxLength } from 'class-validator';

export class AssignParentAffiliateDto {
  @IsString()
  @MaxLength(64)
  parentAffiliateId!: string;
}
