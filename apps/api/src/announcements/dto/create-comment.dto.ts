import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CreateCommentDto as ICreateCommentDto } from '@quanlykhupho/shared-types';

export class CreateCommentDto implements ICreateCommentDto {
  @IsString()
  @IsNotEmpty({ message: 'Nội dung bình luận không được để trống' })
  @MaxLength(1000, { message: 'Bình luận không được vượt quá 1000 ký tự' })
  content: string;
}
