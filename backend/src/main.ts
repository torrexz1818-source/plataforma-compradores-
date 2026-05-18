import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { json, static as expressStatic, urlencoded } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';

dotenv.config();

function parseCorsOrigins() {
  const defaults = [
    'https://buyernodus.com',
    'https://www.buyernodus.com',
  ];

  const configuredOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return configuredOrigins?.length ? configuredOrigins : defaults;
}

function isPrivateIpv4Address(hostname: string) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }

  const octets = hostname.split('.').map((part) => Number(part));

  if (octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  );
}

function isAllowedDevOrigin(origin: string) {
  try {
    const { protocol, hostname } = new URL(origin);

    if (!['http:', 'https:'].includes(protocol)) {
      return false;
    }

    if (
      hostname === 'localhost' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.endsWith('.localhost')
    ) {
      return true;
    }

    if (isPrivateIpv4Address(hostname)) {
      return true;
    }

    if (
      hostname.endsWith('.local') ||
      hostname.endsWith('.test') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.home') ||
      hostname.endsWith('.docker')
    ) {
      return true;
    }

    return !hostname.includes('.');
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const bodySizeLimit = process.env.BODY_SIZE_LIMIT?.trim() || '250mb';
  const host = process.env.HOST?.trim() || '0.0.0.0';
  const uploadDir = join(process.cwd(), 'uploads');
  const expressApp = app.getHttpAdapter().getInstance();

  if (!existsSync(uploadDir)) {
    mkdirSync(uploadDir, { recursive: true });
  }

  expressApp.set('trust proxy', true);

  app.use(json({ limit: bodySizeLimit }));
  app.use(urlencoded({ extended: true, limit: bodySizeLimit }));
  app.use('/uploads', expressStatic(uploadDir));

  const allowedOrigins = new Set(parseCorsOrigins());

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isTryCloudflareOrigin = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin);

      if (allowedOrigins.has(origin) || isAllowedDevOrigin(origin) || isTryCloudflareOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  const port = process.env.PORT || 10000;

  await app.listen(port, host);

  console.log(`Server running on http://${host}:${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Fatal startup error while booting Buyer Nodus backend.');

  if (error instanceof Error) {
    console.error(`${error.name}: ${error.message}`);
    console.error(error.stack);
  } else {
    console.error(error);
  }

  process.exit(1);
});
