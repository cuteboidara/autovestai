import { Body, Controller, Delete, Get, Param, Patch, Post, UseInterceptors } from '@nestjs/common';

import { CacheResource } from '../../common/cache/cache-resource.decorator';
import { CacheTTL } from '../../common/cache/cache-ttl.decorator';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateAccountDto } from './dto/create-account.dto';
import { AccountsService } from './accounts.service';

@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @UseInterceptors(ResponseCacheInterceptor)
  @CacheTTL(10)
  @CacheResource('accounts', 'user')
  listAccounts(@CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.getUserAccounts(user.id);
  }

  @Post()
  createAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAccountDto,
  ) {
    return this.accountsService.createAccount(user.id, dto);
  }

  @Get(':id')
  getAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
  ) {
    return this.accountsService.getAccountById(user.id, accountId);
  }

  @Patch(':id/set-default')
  setDefaultAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
  ) {
    return this.accountsService.setDefaultAccount(user.id, accountId);
  }

  @Patch(':id/reset-demo')
  resetDemoAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
  ) {
    return this.accountsService.resetDemoBalance(user.id, accountId);
  }

  @Delete(':id')
  closeAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') accountId: string,
  ) {
    return this.accountsService.closeAccount(user.id, accountId);
  }
}
