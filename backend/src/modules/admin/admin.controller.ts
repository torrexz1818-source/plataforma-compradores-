import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { AdminGuard } from '../../common/auth/admin.guard';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { AuthenticatedGuard } from '../../common/auth/authenticated.guard';
import { PostsService } from '../posts/posts.service';
import { UploadsService } from '../uploads/uploads.service';
import { UserStatus } from '../users/domain/user-status.enum';
import { MembershipStatus } from '../users/users.service';
import { UsersService } from '../users/users.service';

type CreateManagedPostBody = {
  title: string;
  description: string;
  categoryId: string;
  type: 'educational' | 'community' | 'liquidation';
  learningRoute?: string;
  mediaType?: 'video' | 'image';
  videoUrl?: string;
  thumbnailUrl?: string;
  resources?: Array<{
    id: string;
    type: 'image' | 'file' | 'link';
    name: string;
    url: string;
  }>;
};

type UpdateUserStatusBody = {
  status: UserStatus;
};

type UpdateMembershipBody = {
  plan?: string;
  status?: MembershipStatus;
  adminApproved?: boolean;
  expiresAt?: string;
};

type InitChunkUploadBody = {
  originalName: string;
  totalChunks: number | string;
  totalSize: number | string;
  mimeType?: string;
};

type UploadChunkBody = {
  uploadId: string;
  chunkIndex: number | string;
};

type CompleteChunkUploadBody = {
  uploadId: string;
  originalName: string;
  totalChunks: number | string;
  mimeType?: string;
};

const adminUploadMaxFileSize =
  Number.parseInt(process.env.ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES?.trim() || '', 10) || 2 * 1024 * 1024 * 1024;
const adminUploadChunkSize =
  Number.parseInt(process.env.ADMIN_UPLOAD_CHUNK_SIZE_BYTES?.trim() || '', 10) || 5 * 1024 * 1024;
const adminUploadChunkLimit = adminUploadChunkSize + 1024 * 1024;

@Controller('admin')
@UseGuards(AuthenticatedGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly postsService: PostsService,
    private readonly usersService: UsersService,
    private readonly uploadsService: UploadsService,
  ) {}

  @Get('dashboard')
  getDashboard() {
    return this.postsService.getAdminDashboard();
  }

  @Post('uploads/init')
  initChunkUpload(@Body() body: InitChunkUploadBody) {
    const totalChunks = Number(body.totalChunks);
    const totalSize = Number(body.totalSize);

    if (!body.originalName?.trim() || !Number.isFinite(totalChunks) || totalChunks < 1 || !Number.isFinite(totalSize) || totalSize < 1) {
      throw new BadRequestException('Datos de carga incompletos');
    }

    if (totalSize > adminUploadMaxFileSize) {
      throw new BadRequestException('El archivo excede el limite permitido para videos');
    }

    const uploadId = randomUUID();
    const chunkDir = this.getChunkDir(uploadId);
    this.ensureDir(chunkDir);

    return {
      uploadId,
      chunkSize: adminUploadChunkSize,
      totalChunks,
    };
  }

  @Post('uploads/chunk')
  @UseInterceptors(
    FileInterceptor('chunk', {
      storage: memoryStorage(),
      limits: {
        fileSize: adminUploadChunkLimit,
      },
    }),
  )
  uploadChunk(
    @Body() body: UploadChunkBody,
    @UploadedFile() chunk?: { buffer: Buffer },
  ) {
    const uploadId = body.uploadId?.trim();
    const chunkIndex = Number(body.chunkIndex);

    if (!uploadId || !/^[a-zA-Z0-9-]+$/.test(uploadId) || !Number.isInteger(chunkIndex) || chunkIndex < 0 || !chunk) {
      throw new BadRequestException('Chunk invalido');
    }

    const chunkDir = this.getChunkDir(uploadId);
    this.ensureDir(chunkDir);

    writeFileSync(join(chunkDir, `${chunkIndex}.part`), chunk.buffer);

    return {
      uploadId,
      chunkIndex,
      received: true,
    };
  }

  @Post('uploads/complete')
  async completeChunkUpload(@Body() body: CompleteChunkUploadBody) {
    const uploadId = body.uploadId?.trim();
    const originalName = body.originalName?.trim();
    const totalChunks = Number(body.totalChunks);

    if (!uploadId || !originalName || !/^[a-zA-Z0-9-]+$/.test(uploadId) || !Number.isInteger(totalChunks) || totalChunks < 1) {
      throw new BadRequestException('Carga incompleta');
    }

    const chunkDir = this.getChunkDir(uploadId);

    if (!existsSync(chunkDir)) {
      throw new BadRequestException('No se encontro la carga temporal');
    }

    const uploadDir = this.getUploadDir();
    this.ensureDir(uploadDir);

    const finalFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(originalName || '')}`;
    const finalPath = join(uploadDir, finalFilename);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
      const chunkPath = join(chunkDir, `${chunkIndex}.part`);

      if (!existsSync(chunkPath)) {
        throw new BadRequestException(`Falta la parte ${chunkIndex + 1} del video`);
      }

      appendFileSync(finalPath, readFileSync(chunkPath));
    }

    const uploadedUrl = await this.uploadsService.saveFile({
      filePath: finalPath,
      relativePath: finalFilename,
      originalName,
      mimeType: body.mimeType,
    });

    rmSync(finalPath, { force: true });
    rmSync(chunkDir, { recursive: true, force: true });

    return {
      url: uploadedUrl,
    };
  }

  @Post('posts')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'mainMedia', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ], {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadDir = join(process.cwd(), 'uploads');
          if (!existsSync(uploadDir)) {
            mkdirSync(uploadDir, { recursive: true });
          }
          callback(null, uploadDir);
        },
        filename: (_req, file, callback) => {
          const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname || '')}`;
          callback(null, uniqueName);
        },
      }),
      limits: {
        fileSize: adminUploadMaxFileSize,
      },
    }),
  )
  async createManagedPost(
    @Body() body: CreateManagedPostBody,
    @UploadedFiles() files: {
      mainMedia?: Array<{ filename: string; path: string; originalname: string; mimetype: string }>;
      thumbnail?: Array<{ filename: string; path: string; originalname: string; mimetype: string }>;
    },
    @CurrentUser() user: { sub: string },
  ) {
    const mainMedia = files?.mainMedia?.[0];
    const thumbnail = files?.thumbnail?.[0];
    const parsedResources = this.parseResources(body.resources);
    const bodyMediaType = body.mediaType;
    const uploadedVideoUrl =
      bodyMediaType === 'video' && mainMedia
        ? await this.uploadsService.saveFile({
            filePath: mainMedia.path,
            relativePath: mainMedia.filename,
            originalName: mainMedia.originalname,
            mimeType: mainMedia.mimetype,
          })
        : undefined;
    const uploadedImageUrl =
      bodyMediaType === 'image' && mainMedia
        ? await this.uploadsService.saveFile({
            filePath: mainMedia.path,
            relativePath: mainMedia.filename,
            originalName: mainMedia.originalname,
            mimeType: mainMedia.mimetype,
          })
        : undefined;
    const uploadedThumbnailUrl = thumbnail
      ? await this.uploadsService.saveFile({
          filePath: thumbnail.path,
          relativePath: thumbnail.filename,
          originalName: thumbnail.originalname,
          mimeType: thumbnail.mimetype,
        })
      : undefined;

    if (mainMedia) {
      rmSync(mainMedia.path, { force: true });
    }

    if (thumbnail) {
      rmSync(thumbnail.path, { force: true });
    }

    return this.postsService.createPost({
      title: body.title,
      description: body.description,
      categoryId: body.categoryId,
      type: body.type,
      learningRoute: body.learningRoute,
      mediaType: body.mediaType,
      videoUrl: uploadedVideoUrl ?? body.videoUrl,
      thumbnailUrl: uploadedThumbnailUrl ?? uploadedImageUrl ?? body.thumbnailUrl,
      resources: parsedResources,
      authorId: user.sub,
      isAdmin: true,
    });
  }

  @Delete('posts/:id')
  deletePost(@Param('id') id: string) {
    return this.postsService.deletePost(id);
  }

  @Delete('comments/:id')
  deleteComment(@Param('id') id: string) {
    return this.postsService.deleteComment(id);
  }

  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() body: UpdateUserStatusBody,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.updateStatus(id, body.status, user.sub);
  }

  @Get('memberships')
  listMemberships() {
    return this.usersService.listMemberships();
  }

  @Patch('memberships/:userId')
  updateMembership(
    @Param('userId') userId: string,
    @Body() body: UpdateMembershipBody,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.upsertMembershipByAdmin({
      userId,
      plan: body.plan,
      status: body.status,
      adminApproved: body.adminApproved,
      expiresAt: body.expiresAt,
      approvedBy: user.sub,
    });
  }

  private parseResources(
    value: CreateManagedPostBody['resources'] | string | undefined,
  ): CreateManagedPostBody['resources'] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    try {
      return JSON.parse(value) as CreateManagedPostBody['resources'];
    } catch {
      return [];
    }
  }

  private getUploadDir() {
    return join(process.cwd(), 'uploads');
  }

  private getChunkDir(uploadId: string) {
    return join(this.getUploadDir(), 'tmp-chunks', uploadId);
  }

  private ensureDir(path: string) {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }
}
