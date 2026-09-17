import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AreasModule } from './areas/areas.module';
import { AuthModule } from './auth/auth.module';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './auth/guards/must-change-password.guard';
import { validateEnv } from './config/env.schema';
import { JuridicoModule } from './juridico/juridico.module';
import { PersonalModule } from './personal/personal.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { TrabajoSocialModule } from './trabajo-social/trabajo-social.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    TrabajoSocialModule,
    AreasModule,
    PersonalModule,
    JuridicoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // "Todo protegido por defecto": JwtAuthGuard exige sesión salvo @Public().
    // CsrfGuard valida X-CSRF-Token en verbos mutantes. MustChangePasswordGuard
    // corre último porque depende de request.user, que ya puso JwtAuthGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
  ],
})
export class AppModule {}
