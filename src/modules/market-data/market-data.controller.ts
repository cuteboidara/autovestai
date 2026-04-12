import { Controller, Get, Param, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator';
import { HistoryQueryDto } from './dto/history-query.dto';
import { ListSymbolsQueryDto } from './dto/list-symbols-query.dto';
import { MarketDataService } from './market-data.service';

@Public()
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('config')
  getConfig() {
    return this.marketDataService.getConfig();
  }

  @Get('symbols')
  listSymbols(@Query() query: ListSymbolsQueryDto) {
    return this.marketDataService.listSymbols(query);
  }

  @Get('symbols/:symbol')
  getSymbolInfo(@Param('symbol') symbol: string) {
    return this.marketDataService.getSymbolInfo(symbol);
  }

  @Get('history')
  getHistory(@Query() query: HistoryQueryDto) {
    return this.marketDataService.getHistory(query);
  }

  @Get('price/:symbol')
  getCurrentPrice(@Param('symbol') symbol: string) {
    return this.marketDataService.getCurrentPrice(symbol);
  }
}
