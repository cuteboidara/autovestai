import { Body, Controller, Get, Post, Query, UseInterceptors } from '@nestjs/common';

import { CacheResource } from '../../common/cache/cache-resource.decorator';
import { CacheTTL } from '../../common/cache/cache-ttl.decorator';
import { ResponseCacheInterceptor } from '../../common/cache/response-cache.interceptor';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ClosePositionDto } from './dto/close-position.dto';
import { ListPositionsQueryDto } from './dto/list-positions-query.dto';
import { PositionsService } from './positions.service';

@Controller('positions')
export class PositionsController {
  constructor(private readonly positionsService: PositionsService) {}

  @Get()
  @UseInterceptors(ResponseCacheInterceptor)
  @CacheTTL(3)
  @CacheResource('positions', 'account')
  listUserPositions(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPositionsQueryDto,
  ) {
    return this.positionsService.listUserPositions(
      user.id,
      query.accountId,
      query.status,
    );
  }

  @Post('close')
  @RateLimit({
    keyPrefix: 'position-close',
    limit: 30,
    ttlSeconds: 60,
  })
  closePosition(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClosePositionDto,
  ) {
    return this.positionsService.closePosition(user.id, dto);
  }
}
