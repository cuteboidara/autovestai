import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';

import { CacheResource } from '../../common/cache/cache-resource.decorator';
import { CacheTTL } from '../../common/cache/cache-ttl.decorator';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { GetDepositAddressDto } from './dto/get-deposit-address.dto';
import { ListDepositsQueryDto } from './dto/list-deposits-query.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { ListWithdrawalsQueryDto } from './dto/list-withdrawals-query.dto';
import { RequestDepositDto } from './dto/request-deposit.dto';
import { RequestWithdrawDto } from './dto/request-withdraw.dto';
import { WalletService } from './wallet.service';

@Controller()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('wallet')
  getWallet(@CurrentUser() user: AuthenticatedUser) {
    return this.walletService.getWallet(user.id);
  }

  @Get('wallet/deposit-address')
  @RateLimit({
    keyPrefix: 'wallet-deposit-address',
    limit: 10,
    ttlSeconds: 3600,
  })
  getDepositAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetDepositAddressDto,
  ) {
    return this.walletService.getDepositAddress(user.id, query.network);
  }

  @Get('wallet/address')
  @RateLimit({
    keyPrefix: 'wallet-address',
    limit: 10,
    ttlSeconds: 3600,
  })
  getWalletAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetDepositAddressDto,
  ) {
    return this.walletService.getDepositAddress(user.id, query.network);
  }

  @Post('wallet/generate-address')
  @RateLimit({
    keyPrefix: 'wallet-generate-address',
    limit: 10,
    ttlSeconds: 3600,
  })
  generateWalletAddress(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GetDepositAddressDto,
  ) {
    return this.walletService.getDepositAddress(user.id, dto.network);
  }

  @Get('wallet/addresses')
  @RateLimit({
    keyPrefix: 'wallet-addresses',
    limit: 10,
    ttlSeconds: 3600,
  })
  getWalletAddresses(
    @CurrentUser() user: AuthenticatedUser,
    @Query('accountId') accountId?: string,
  ) {
    return this.walletService.getDepositAddresses(user.id, accountId);
  }

  @Get('wallet/transactions')
  @UseInterceptors(ResponseCacheInterceptor)
  @CacheTTL(30)
  @CacheResource('transactions', 'user')
  listTransactions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.walletService.listTransactions(user.id, query);
  }

  @Get('wallet/deposits')
  @UseInterceptors(ResponseCacheInterceptor)
  @CacheTTL(30)
  @CacheResource('transactions', 'user')
  listDeposits(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDepositsQueryDto,
  ) {
    return this.walletService.listDeposits(user.id, query);
  }

  @Get('wallet/withdrawals')
  @UseInterceptors(ResponseCacheInterceptor)
  @CacheTTL(30)
  @CacheResource('transactions', 'user')
  listWithdrawals(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWithdrawalsQueryDto,
  ) {
    return this.walletService.listWithdrawals(user.id, query);
  }

  @Post('deposit')
  @RateLimit({
    keyPrefix: 'wallet-deposit',
    limit: 20,
    ttlSeconds: 300,
  })
  requestDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestDepositDto,
  ) {
    return this.walletService.requestDeposit(user.id, dto);
  }

  @Post('withdraw')
  @RateLimit({
    keyPrefix: 'wallet-withdraw',
    limit: 10,
    ttlSeconds: 300,
  })
  requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestWithdrawDto,
  ) {
    return this.walletService.requestWithdrawal(user.id, dto);
  }
}
