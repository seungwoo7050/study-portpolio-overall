import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateWorkspaceItemDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  content?: string;
}
