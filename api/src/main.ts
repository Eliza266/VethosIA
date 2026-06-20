import 'reflect-metadata';
import * as dotenv from 'dotenv';
// Carga api/.env en local/dev (en Cloud Run las envs vienen del entorno/Secret Manager,
// y si no hay .env esto es no-op). Debe correr ANTES de leer cualquier process.env.
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { loadAppConfig } from './common/config/env';
import { validateEnv } from './common/config/env.schema';

async function bootstrap(): Promise<void> {
  // fail-fast: si una env critica falta o es invalida, no arrancamos.
  validateEnv();
  const cfg = loadAppConfig();
  // Limite alto para /v1/ia/transcribir con audioBase64 inline (frontend sync path).
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // base path del contrato: /v1. El frontend pega contra esto.
  app.setGlobalPrefix(cfg.apiPrefix);

  // validacion global de DTOs. whitelist: ignora props no declaradas;
  // transform: convierte payloads a las clases DTO (y tipos primitivos).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // CORS CERRADO por defecto en prod: si no se setea CORS_ORIGIN, no abrimos a cualquiera.
  // En dev (sin NODE_ENV=production) permitimos todo para comodidad local.
  const origins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
  const esProd = process.env.NODE_ENV === 'production';
  app.enableCors({ origin: origins && origins.length > 0 ? origins : esProd ? false : true });

  // Cloud Run inyecta el puerto via env PORT. Escuchar en 0.0.0.0 es obligatorio en contenedor.
  await app.listen(cfg.port, '0.0.0.0');
  Logger.log(`VetIA API escuchando en :${cfg.port}/${cfg.apiPrefix}`, 'Bootstrap');
}

void bootstrap();
