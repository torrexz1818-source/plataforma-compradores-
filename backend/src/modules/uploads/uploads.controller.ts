import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Request, Response } from 'express';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { UploadsService } from './uploads.service';

const uploadMaxFileSize =
  Number.parseInt(process.env.UPLOAD_MAX_FILE_SIZE_BYTES?.trim() || '', 10) || 50 * 1024 * 1024;

type UploadPurpose = 'general' | 'messages' | 'posts' | 'resources' | 'supplier-onboarding';

const supplierOnboardingMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get(':filename')
  serveRootUpload(
    @Param('filename') filename: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.serveUpload(filename, request, response);
  }

  @Get(':purpose/:filename')
  servePurposeUpload(
    @Param('purpose') purpose: string,
    @Param('filename') filename: string,
    @Req() request: Request,
    @Res() response: Response,
  ) {
    return this.serveUpload(`${purpose}/${filename}`, request, response);
  }

  @Post('file')
  @UseGuards(AuthenticatedGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: uploadMaxFileSize,
      },
    }),
  )
  async uploadFile(
    @UploadedFile()
    file?: {
      originalname: string;
      buffer: Buffer;
      mimetype: string;
      size: number;
    },
    @Query('purpose') purpose?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona un archivo para subir');
    }

    const normalizedPurpose = UploadsController.normalizePurpose(purpose);
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname || '')}`;
    const relativePath = `${normalizedPurpose}/${uniqueName}`;

    return {
      file: {
        url: await this.uploadsService.saveBuffer({
          buffer: file.buffer,
          relativePath,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        }),
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    };
  }

  @Post('supplier-onboarding')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: uploadMaxFileSize,
      },
    }),
  )
  async uploadSupplierOnboardingFile(
    @UploadedFile()
    file?: {
      originalname: string;
      buffer: Buffer;
      mimetype: string;
      size: number;
    },
  ) {
    if (!file) {
      throw new BadRequestException('Selecciona un archivo para subir');
    }

    if (!supplierOnboardingMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Solo se permiten archivos PDF o imagenes');
    }

    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname || '')}`;
    const relativePath = `supplier-onboarding/${uniqueName}`;

    return {
      file: {
        url: await this.uploadsService.saveBuffer({
          buffer: file.buffer,
          relativePath,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        }),
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    };
  }

  private async serveUpload(relativePath: string, request: Request, response: Response) {
    const file = await this.uploadsService.findFile(relativePath);
    const contentType =
      (file.metadata as { mimeType?: string } | undefined)?.mimeType || 'application/octet-stream';
    const rangeHeader = request.headers.range;

    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Content-Type', contentType);

    if (rangeHeader) {
      const range = this.parseRange(rangeHeader, file.length);

      if (!range) {
        response.status(416).setHeader('Content-Range', `bytes */${file.length}`);
        response.end();
        return;
      }

      response.status(206);
      response.setHeader('Content-Length', range.end - range.start + 1);
      response.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${file.length}`);
      this.uploadsService
        .openDownloadStream(file, { start: range.start, endExclusive: range.end + 1 })
        .pipe(response);
      return;
    }

    response.setHeader('Content-Length', file.length);
    this.uploadsService.openDownloadStream(file).pipe(response);
  }

  private parseRange(rangeHeader: string, fileSize: number) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);

    if (!match) {
      return null;
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : fileSize - 1;

    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= fileSize) {
      return null;
    }

    return {
      start,
      end: Math.min(end, fileSize - 1),
    };
  }

  private static normalizePurpose(value?: string): UploadPurpose {
    if (value === 'messages' || value === 'posts' || value === 'resources' || value === 'supplier-onboarding') {
      return value;
    }

    return 'general';
  }
}
