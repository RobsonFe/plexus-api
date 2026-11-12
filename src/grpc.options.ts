import { ReflectionService } from '@grpc/reflection';
import { ConfigService } from '@nestjs/config';
import { GrpcOptions, Transport } from '@nestjs/microservices';
import { join } from 'node:path';

/**
 * Monta as opções do microservice gRPC, compartilhadas entre o bootstrap e o e2e.
 *
 * @param config Configuração da aplicação
 * @returns Opções de transporte gRPC dos serviços clínico e de pacientes
 */
export function createGrpcOptions(config: ConfigService): GrpcOptions {
  return {
    transport: Transport.GRPC,
    options: {
      package: ['plexus.clinic.v1', 'plexus.patient.v1'],
      protoPath: [
        join(__dirname, 'modules/clinical/proto/clinical.proto'),
        join(__dirname, 'modules/patient/proto/patient.proto'),
      ],
      // Enquanto não houver autenticação e TLS, o padrão não expõe o serviço na rede.
      url: config.get<string>('GRPC_URL', 'localhost:50051'),
      loader: {
        keepCase: false,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
      },
      onLoadPackageDefinition: (pkg, server) => {
        if (config.get<string>('NODE_ENV') !== 'production') {
          new ReflectionService(pkg).addToServer(server);
        }
      },
    },
  };
}
