import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

/** C 端登录：微信 wx.login 拿到的 code */
export class UserLoginDto {
  @ApiProperty({ description: '微信 wx.login 返回的 code', example: 'dev-code-1001' })
  @IsString()
  @Length(1, 128)
  code!: string;
}
