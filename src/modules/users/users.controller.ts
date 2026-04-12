import { Body, Controller, Get, Patch } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getCurrentUser(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUserProfile(user.id);
  }

  @Patch('me/password')
  changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, dto);
  }
}
