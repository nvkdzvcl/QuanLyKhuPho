import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PetitionCategory } from '@quanlykhupho/shared-types';

export class CreatePetitionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Tiêu đề kiến nghị phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tiêu đề kiến nghị không được để trống' })
  @MaxLength(255, { message: 'Tiêu đề kiến nghị tối đa 255 ký tự' })
  title: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Nội dung kiến nghị phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Nội dung kiến nghị không được để trống' })
  @MaxLength(5000, { message: 'Nội dung kiến nghị tối đa 5000 ký tự' })
  description: string;

  @IsNotEmpty({ message: 'Danh mục kiến nghị không được để trống' })
  @IsEnum(PetitionCategory, {
    message:
      'Danh mục không hợp lệ. Cho phép: infrastructure, sanitation, security, other',
  })
  category: PetitionCategory;
}
