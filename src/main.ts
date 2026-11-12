import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { ConfigService } from '@nestjs/config';
import { MicroserviceOptions } from '@nestjs/microservices';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createGrpcOptions } from './grpc.options';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.setGlobalPrefix('api/v1', {
        exclude: ['/'],
    });

    app.enableCors({
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    const config = new DocumentBuilder()
        .setTitle(" Plexus")
        .setDescription('API de estudo de gRCP Fullstack e novo projeto de estudo de NestJS com TypeScript, PostgreSQL, Redis, Docker, Swagger e JWT.')
        .setContact('Robson Ferreira da Silva', 'https://github.com/RobsonFe', 'robsonfe.dev@gmail.com') 
        .setLicense('MIT', 'https://mit-license.org/')
        .setTermsOfService('https://www.termsfeed.com/live/38226a32-d1fb-4783-8925-ad4706359984')
        .setExternalDoc('Documentação da API com todas as fases e especificações do projeto.', 'https://docs.google.com/document/d/1ZEBIqUWARSRgf9nwzdOd5fPf2UZD_VuFm8nMKpzmBAw/edit?usp=sharing')
        .setVersion('1.0')
        .addTag('Plexus')
        .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('doc', app, document, {
            customSiteTitle: 'Plexus',
        });

    app.connectMicroservice<MicroserviceOptions>(
        createGrpcOptions(app.get(ConfigService)),
        { inheritAppConfig: true },
    );
    await app.startAllMicroservices();

    await app.listen(process.env.PORT ?? 8080);

    if (app) {
      console.log(`Aplicação rodando na porta: ${await app.getUrl()}`);
      console.log(`Documentação disponível em: ${await app.getUrl()}/doc`);
    } else {
      console.log('Erro ao iniciar a aplicação');
    }

}

void bootstrap();
