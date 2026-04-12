import { Body, Controller, Get, Param, Patch, Post, Query, UseInterceptors } from '@nestjs/common';

import { CacheResource } from '../../common/cache/cache-resource.decorator';
import { CacheTTL } from '../../common/cache/cache-ttl.decorator';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ListSignalProvidersQueryDto } from './dto/list-signal-providers-query.dto';
import { RegisterSignalProviderDto } from './dto/register-signal-provider.dto';
import { UpdateSignalProviderDto } from './dto/update-signal-provider.dto';
import { CopyTradingService } from './copy-trading.service';

@Controller('copy-trading')
export class ProvidersController {
  constructor(private readonly copyTradingService: CopyTradingService) {}

  @Public()
  @Get('providers')
  @UseInterceptors(ResponseCacheInterceptor)
  @CacheTTL(60)
  @CacheResource('copy-trading-providers', 'public')
  listProviders(@Query() query: ListSignalProvidersQueryDto): Promise<unknown> {
    return this.copyTradingService.listProviders(query);
  }

  @Get('providers/me')
  getMyProvider(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.copyTradingService.getMyProvider(user.id);
  }

  @Public()
  @Get('providers/:id')
  getProviderProfile(@Param('id') providerId: string): Promise<unknown> {
    return this.copyTradingService.getProviderProfile(providerId);
  }

  @Post('providers/register')
  registerProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegisterSignalProviderDto,
  ): Promise<unknown> {
    return this.copyTradingService.registerProvider(user.id, dto);
  }

  @Patch('providers/me')
  updateProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSignalProviderDto,
  ): Promise<unknown> {
    return this.copyTradingService.updateMyProvider(user.id, dto);
  }
}
