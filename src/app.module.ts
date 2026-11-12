import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClinicalModule } from './modules/clinical/module/clinical.module';
import { PatientModule } from './modules/patient/module/patient.module';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Rastreamento distribuído, logs correlacionados automaticamente, métricas de requisições e jobs,
    // telemetria de erros, alarmes e muito mais, prontos para uso. Cadastre-se em https://observe.nestjs.com
    ObserveModule.forRoot({
      appKey: 'YOUR_APP_KEY',
      appSecret: 'YOUR_APP_SECRET',
      serviceId: 'api-plexus',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5433),
        username: configService.get<string>('DB_USERNAME', 'plexus'),
        password: configService.get<string>('DB_PASSWORD', 'plexus'),
        database: configService.get<string>('DB_DATABASE', 'plexusdb'),
        autoLoadEntities: true,
        synchronize: false, // Use true apenas em desenvolvimento; em produção, use migrations
      }),
    }),
    ClinicalModule,
    PatientModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
