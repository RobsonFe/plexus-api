import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns the welcome message', () => {
      expect(appController.getHello()).toBe(
        'Olá, Plexus! Bem-vindo à API de estudo de gRCP Fullstack e novo projeto de estudo de NestJS com TypeScript, PostgreSQL, Redis, Docker, Swagger e JWT.',
      );
    });
  });
});
