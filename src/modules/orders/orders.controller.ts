import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListOrdersQueryDto,
  ) {
    return this.ordersService.listOrders(user.id, query);
  }

  @Post()
  @RateLimit({
    keyPrefix: 'order-placement',
    limit: 120,
    ttlSeconds: 60,
  })
  placeOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PlaceOrderDto,
  ): Promise<unknown> {
    return this.ordersService.placeOrder(user.id, dto);
  }
}
