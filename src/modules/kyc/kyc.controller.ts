import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { KycDecisionDto } from './dto/kyc-decision.dto';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { UploadKycFileDto } from './dto/upload-kyc-file.dto';
import { KycService } from './kyc.service';

function buildSafeFilename(originalName: string) {
  const extension = extname(originalName);
  const baseName = originalName
    .replace(extension, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

  return `${Date.now()}-${baseName || 'document'}${extension}`;
}

@Controller()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Post('kyc/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (
          request: Request & { user?: { id?: string } },
          _file: Express.Multer.File,
          callback: (error: Error | null, destination: string) => void,
        ) => {
          const userId =
            request.user?.id ?? 'unknown';
          const destination = join(process.cwd(), 'uploads', 'kyc', userId);

          mkdirSync(destination, { recursive: true });
          callback(null, destination);
        },
        filename: (
          _request: Request,
          file: Express.Multer.File,
          callback: (error: Error | null, filename: string) => void,
        ) => {
          callback(null, buildSafeFilename(file.originalname));
        },
      }),
    }),
  )
  uploadKycFile(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile()
    file: {
      filename: string;
      path: string;
      mimetype: string;
      originalname: string;
    },
    @Body() dto: UploadKycFileDto,
  ) {
    return this.kycService.registerUploadedDocument(user.id, file, dto.kind, dto.label);
  }

  @Post('kyc/submit')
  submitKyc(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SubmitKycDto,
  ) {
    return this.kycService.submit(user.id, dto);
  }

  @Get('kyc/me')
  getMyKyc(@CurrentUser() user: AuthenticatedUser) {
    return this.kycService.getMine(user.id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('kyc.approve')
  @Get('admin/kyc')
  listForAdmin() {
    return this.kycService.listForAdmin();
  }

  @Roles(UserRole.ADMIN)
  @Permissions('kyc.approve')
  @Get('admin/kyc/:id')
  getAdminDetail(@Param('id') id: string) {
    return this.kycService.getAdminDetail(id);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('kyc.approve')
  @RateLimit({
    keyPrefix: 'admin-kyc-approve',
    limit: 60,
    ttlSeconds: 300,
  })
  @Post('admin/kyc/:id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: KycDecisionDto,
  ) {
    return this.kycService.approve(id, admin.id, dto.reason);
  }

  @Roles(UserRole.ADMIN)
  @Permissions('kyc.approve')
  @RateLimit({
    keyPrefix: 'admin-kyc-reject',
    limit: 60,
    ttlSeconds: 300,
  })
  @Post('admin/kyc/:id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: KycDecisionDto,
  ) {
    return this.kycService.reject(id, admin.id, dto.reason);
  }
}
