import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class CreateWorkspaceItemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  content?: string;
}
