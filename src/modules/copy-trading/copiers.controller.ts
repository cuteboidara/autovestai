import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { StartCopyDto } from './dto/start-copy.dto';
import { UpdateCopyRelationDto } from './dto/update-copy-relation.dto';
import { CopyTradingService } from './copy-trading.service';

@Controller('copy-trading')
export class CopiersController {
  constructor(private readonly copyTradingService: CopyTradingService) {}

  @Post('copy/:providerId')
  startCopying(
    @CurrentUser() user: AuthenticatedUser,
    @Param('providerId') providerId: string,
    @Body() dto: StartCopyDto,
  ): Promise<unknown> {
    return this.copyTradingService.startCopying(user.id, providerId, dto);
  }

  @Patch('copy/:id')
  updateCopyRelation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') relationId: string,
    @Body() dto: UpdateCopyRelationDto,
  ): Promise<unknown> {
    return this.copyTradingService.updateCopyRelation(user.id, relationId, dto);
  }

  @Delete('copy/:id')
  stopCopying(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') relationId: string,
  ): Promise<unknown> {
    return this.copyTradingService.stopCopying(user.id, relationId);
  }

  @Get('my-copies')
  listMyCopies(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.copyTradingService.listMyCopies(user.id);
  }
}
