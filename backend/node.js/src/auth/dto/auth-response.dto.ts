import { UserResponseDto } from '../../user/dto/user-response.dto';

export class AuthResponseDto {
  accessToken: string;
  access_token: string;
  user: UserResponseDto;

  constructor(accessToken: string, user: UserResponseDto) {
    this.accessToken = accessToken;
    this.access_token = accessToken;
    this.user = user;
  }
}
