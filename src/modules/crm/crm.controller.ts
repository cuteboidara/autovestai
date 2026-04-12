import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateClientNoteDto } from './dto/create-client-note.dto';
import { CreateEmailSenderConfigDto } from './dto/create-email-sender-config.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { SaveEmailTemplateDto } from './dto/save-email-template.dto';
import { SendCrmEmailDto } from './dto/send-crm-email.dto';
import { UpdateClientNoteDto } from './dto/update-client-note.dto';
import { UpdateEmailSenderConfigDto } from './dto/update-email-sender-config.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { CrmService } from './crm.service';

@Roles(UserRole.ADMIN)
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  @Permissions('crm.read')
  @Get('clients')
  getClients(@Query() query: ListClientsQueryDto) {
    return this.crmService.getClients(query);
  }

  @Permissions('crm.read')
  @Get('clients/:accountNumber')
  getClientProfile(@Param('accountNumber') accountNumber: string) {
    return this.crmService.getClientProfile(accountNumber);
  }

  @Permissions('crm.notes')
  @Post('clients/:id/notes')
  addClientNote(
    @Param('id') clientId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateClientNoteDto,
  ) {
    return this.crmService.addClientNote(clientId, admin, dto);
  }

  @Permissions('crm.read')
  @Get('clients/:id/notes')
  listClientNotes(@Param('id') clientId: string) {
    return this.crmService.listClientNotes(clientId);
  }

  @Permissions('crm.notes')
  @Patch('clients/:id/notes/:noteId')
  updateClientNote(
    @Param('id') clientId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: UpdateClientNoteDto,
  ) {
    return this.crmService.updateClientNote(clientId, noteId, admin, dto);
  }

  @Permissions('crm.notes')
  @Delete('clients/:id/notes/:noteId')
  deleteClientNote(
    @Param('id') clientId: string,
    @Param('noteId') noteId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.crmService.deleteClientNote(clientId, noteId, admin);
  }

  @Permissions('email.send')
  @Post('email/send')
  sendEmail(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: SendCrmEmailDto,
  ) {
    return this.crmService.sendEmail(admin, dto);
  }

  @Permissions('crm.read')
  @Get('email/logs')
  listEmailLogs() {
    return this.crmService.listEmailLogs();
  }

  @Permissions('crm.read')
  @Get('email/logs/:clientId')
  listEmailLogsForClient(@Param('clientId') clientId: string) {
    return this.crmService.listEmailLogs(clientId);
  }

  @Permissions('email.send')
  @Post('email/templates')
  createTemplate(@Body() dto: SaveEmailTemplateDto) {
    return this.crmService.createTemplate(dto);
  }

  @Permissions('email.send')
  @Get('email/templates')
  listTemplates() {
    return this.crmService.listTemplates();
  }

  @Permissions('email.send')
  @Patch('email/templates/:id')
  updateTemplate(
    @Param('id') templateId: string,
    @Body() dto: UpdateEmailTemplateDto,
  ) {
    return this.crmService.updateTemplate(templateId, dto);
  }

  @Permissions('email.send')
  @Delete('email/templates/:id')
  deleteTemplate(@Param('id') templateId: string) {
    return this.crmService.deleteTemplate(templateId);
  }

  @Permissions('email.send')
  @Get('email/senders')
  listSenderConfigs() {
    return this.crmService.listSenderConfigs();
  }

  @Permissions('email.settings')
  @Post('email/senders')
  createSenderConfig(@Body() dto: CreateEmailSenderConfigDto) {
    return this.crmService.createSenderConfig(dto);
  }

  @Permissions('email.settings')
  @Patch('email/senders/:id')
  updateSenderConfig(
    @Param('id') senderId: string,
    @Body() dto: UpdateEmailSenderConfigDto,
  ) {
    return this.crmService.updateSenderConfig(senderId, dto);
  }

  @Permissions('email.settings')
  @Delete('email/senders/:id')
  deleteSenderConfig(@Param('id') senderId: string) {
    return this.crmService.deleteSenderConfig(senderId);
  }

  @Permissions('email.settings')
  @Post('email/senders/:id/test')
  testSenderConfig(
    @Param('id') senderId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.crmService.testSenderConfig(senderId, admin);
  }
}
