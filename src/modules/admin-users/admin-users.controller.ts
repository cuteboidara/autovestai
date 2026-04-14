import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminUsersService } from './admin-users.service';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@Roles(UserRole.ADMIN)
@Controller('admin/admin-users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Permissions('admin-users.manage')
  @Get()
  listAdmins(@Query() query: AdminUserListQueryDto) {
    return this.adminUsersService.listAdmins(query);
  }

  @Permissions('admin-users.manage')
  @Post()
  createAdmin(
    @Body() dto: CreateAdminUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.createAdmin(dto, admin.id);
  }

  @Permissions('admin-users.manage')
  @Get(':id')
  getAdmin(@Param('id') adminId: string) {
    return this.adminUsersService.getAdminProfile(adminId);
  }

  @Permissions('admin-users.manage')
  @Patch(':id')
  updateAdmin(
    @Param('id') adminId: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.updateAdmin(adminId, dto, admin.id);
  }

  @Permissions('admin-users.manage')
  @Delete(':id')
  deactivateAdmin(
    @Param('id') adminId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.deactivateAdmin(adminId, admin.id);
  }

  @Permissions('admin-users.manage')
  @Post(':id/reset-password')
  resetPassword(
    @Param('id') adminId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminUsersService.resetPassword(adminId, admin.id);
  }

  @Post('me/change-password')
  changeMyPassword(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    return this.adminUsersService.changeMyPassword(
      admin.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
