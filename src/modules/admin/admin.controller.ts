import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';
import { UserRole, WithdrawalStatus } from '@prisma/client';

import { CacheResource } from '../../common/cache/cache-resource.decorator';
import { CacheTTL } from '../../common/cache/cache-ttl.decorator';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { AdminCopyTradesQueryDto } from './dto/admin-copy-trades-query.dto';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { TransactionDecisionDto } from './dto/transaction-decision.dto';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
import { UpdateSymbolConfigDto } from './dto/update-symbol-config.dto';
import { AdminService } from './admin.service';
import { ListTransactionsQueryDto } from '../wallet/dto/list-transactions-query.dto';
import { MarkWithdrawalSentDto } from '../wallet/dto/mark-withdrawal-sent.dto';
import { ReviewWithdrawalDto } from '../wallet/dto/review-withdrawal.dto';

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Permissions('transactions.view')
  @Get('transactions/pending')
  listPendingTransactions() {
    return this.adminService.listPendingTransactions();
  }

  @Permissions('transactions.view')
  @RateLimit({
    keyPrefix: 'admin-transaction-approve',
    limit: 60,
    ttlSeconds: 300,
  })
  @Post('transactions/:id/approve')
  approveTransaction(
    @Param('id') transactionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: TransactionDecisionDto,
  ) {
    return this.adminService.approveTransaction(transactionId, admin, dto.reason);
  }

  @Permissions('transactions.view')
  @RateLimit({
    keyPrefix: 'admin-transaction-reject',
    limit: 60,
    ttlSeconds: 300,
  })
  @Post('transactions/:id/reject')
  rejectTransaction(
    @Param('id') transactionId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: TransactionDecisionDto,
  ) {
    return this.adminService.rejectTransaction(transactionId, admin, dto.reason);
  }

  @Permissions('settings.manage')
  @Get('settings')
  getSettings() {
    return this.adminService.getSettings();
  }

  @Permissions('dashboard.view')
  @Get('overview')
  @UseInterceptors(ResponseCacheInterceptor)
  @CacheTTL(5)
  @CacheResource('admin-dashboard-overview', 'user')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Permissions('queues.manage')
  @Get('queues/failed-jobs')
  listFailedQueueJobs() {
    return this.adminService.listFailedQueueJobs();
  }

  @Permissions('queues.manage')
  @Post('queues/retry-all')
  retryAllFailedQueueJobs() {
    return this.adminService.retryAllFailedQueueJobs();
  }

  @Permissions('users.view')
  @Get('users')
  listUsers(@Query() query: AdminUserListQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Permissions('users.view')
  @Get('users/:id')
  getUserDetail(@Param('id') userId: string) {
    return this.adminService.getUserDetail(userId);
  }

  @Permissions('users.manage')
  @Post('users/:id/suspend')
  suspendUser(
    @Param('id') userId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminService.suspendUser(userId, admin);
  }

  @Permissions('users.manage')
  @Post('users/:id/activate')
  activateUser(
    @Param('id') userId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminService.activateUser(userId, admin);
  }

  @Permissions('settings.manage')
  @RateLimit({
    keyPrefix: 'admin-settings',
    limit: 30,
    ttlSeconds: 300,
  })
  @Patch('settings')
  updateSettings(
    @Body() dto: UpdateAdminSettingsDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminService.updateSettings(admin, dto);
  }

  @Permissions('settings.manage')
  @Get('symbol-config')
  getSymbolConfigs() {
    return this.adminService.getSymbolConfigs();
  }

  @Permissions('settings.manage')
  @Get('symbols')
  listSymbols() {
    return this.adminService.listSymbols();
  }

  @Permissions('settings.manage')
  @RateLimit({
    keyPrefix: 'admin-symbol-config',
    limit: 30,
    ttlSeconds: 300,
  })
  @Patch('symbol-config/:symbol')
  updateSymbolConfig(
    @Param('symbol') symbol: string,
    @Body() dto: UpdateSymbolConfigDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminService.updateSymbolConfig(admin, symbol, dto);
  }

  @Permissions('settings.manage')
  @RateLimit({
    keyPrefix: 'admin-symbols',
    limit: 30,
    ttlSeconds: 300,
  })
  @Patch('symbols/:symbol')
  updateSymbol(
    @Param('symbol') symbol: string,
    @Body() dto: UpdateSymbolConfigDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.adminService.updateSymbol(admin, symbol, dto);
  }

  @Permissions('transactions.view')
  @Get('wallet/transactions')
  listWalletTransactions(@Query() query: ListTransactionsQueryDto) {
    return this.adminService.listWalletTransactions(query);
  }

  @Permissions('transactions.view')
  @Get('wallet/deposit-addresses')
  listDepositAddresses() {
    return this.adminService.listDepositAddresses();
  }

  @Permissions('transactions.view')
  @Get('wallet/incoming-transactions')
  listIncomingTransactions() {
    return this.adminService.listIncomingTransactions();
  }

  @Permissions('transactions.view')
  @Get('withdrawals')
  listWithdrawals(@Query('status') status?: WithdrawalStatus) {
    return this.adminService.listWithdrawals(status);
  }

  @Permissions('withdrawals.approve')
  @Post('withdrawals/:id/approve')
  approveWithdrawal(
    @Param('id') withdrawalId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    return this.adminService.approveWithdrawal(withdrawalId, admin, dto.reason);
  }

  @Permissions('withdrawals.approve')
  @Post('withdrawals/:id/reject')
  rejectWithdrawal(
    @Param('id') withdrawalId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewWithdrawalDto,
  ) {
    return this.adminService.rejectWithdrawal(
      withdrawalId,
      admin,
      dto.reason ?? 'Rejected by admin',
    );
  }

  @Permissions('withdrawals.approve')
  @Post('withdrawals/:id/mark-sent')
  markWithdrawalAsSent(
    @Param('id') withdrawalId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: MarkWithdrawalSentDto,
  ) {
    return this.adminService.markWithdrawalAsSent(
      withdrawalId,
      admin,
      dto.txHash,
      dto.adminNote,
    );
  }

  @Permissions('copy.approve')
  @Get('copy-trading/masters')
  listCopyMasters() {
    return this.adminService.listCopyMasters();
  }

  @Permissions('copy.approve')
  @Get('copy-trading/trades')
  listCopyTrades(@Query() query: AdminCopyTradesQueryDto) {
    return this.adminService.listCopyTrades(query);
  }

  @Permissions('positions.view')
  @Get('positions/open')
  listOpenPositions() {
    return this.adminService.listOpenPositions();
  }

  @Permissions('orders.view')
  @Get('orders')
  listOrders() {
    return this.adminService.listOrders();
  }

  @Permissions('affiliate.manage')
  @Get('affiliates')
  listAffiliates() {
    return this.adminService.listAffiliates();
  }

  @Permissions('affiliate.manage')
  @Get('affiliates/commissions')
  listAffiliateCommissions() {
    return this.adminService.listAffiliateCommissions();
  }
}
