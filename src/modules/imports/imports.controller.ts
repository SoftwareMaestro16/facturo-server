import { Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiCreatedResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

import { ImportResponse, ImportUploadDto } from './dto';
import { ImportsService } from './imports.service';

@ApiTags('imports')
@ApiCookieAuth()
@Controller('imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @Roles('OWNER', 'ACCOUNTANT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024, files: 1, fields: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImportUploadDto })
  @ApiCreatedResponse({ type: ImportResponse })
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ImportUploadDto,
    @UploadedFile() file?: { buffer: Buffer; originalname: string },
  ): Promise<ImportResponse> {
    return this.imports.upload(user.companyId, dto.kind, file);
  }
}
