import { Injectable } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CreatePatientDto } from "../dto/create-patient.dto";
import { UpdatePatientDto } from "../dto/update-patient.dto";

@Injectable()
export class PatientRepository {

    constructor(private readonly dataSource: DataSource) {}

    public async createPatient(patient:CreatePatientDto): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            await manager
                .createQueryBuilder()
                .insert()
                .into('patient')
                .values({
                    full_name: patient.fullName,
                    document_cpf: patient.cpf,
                    phone: patient.phone,
                })
                .execute();
        });
    }

    public async findPatientByCpf(cpf: string): Promise<{ id: string } | null> {
        const result = await this.dataSource
            .createQueryBuilder()
            .select('id')
            .from('patient', 'p')
            .where('p.document_cpf = :cpf', { cpf })
            .getRawOne();
                return result;
    }

    public async updatePatient(patient: UpdatePatientDto): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            await manager
                .createQueryBuilder()
                .update('patient')
                .set({
                    full_name: patient.fullName,
                    phone: patient.phone,
                })
                .where('document_cpf = :cpf', { cpf: patient.cpf })
                .execute();
        });
    }

    public async deletePatientByCpf(cpf: string): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            await manager
                .createQueryBuilder()
                .delete()
                .from('patient')
                .where('document_cpf = :cpf', { cpf })
                .execute();
        });
    }

    public async findPatientById(id: string): Promise<{ id: string } | null> {
        const result = await this.dataSource
            .createQueryBuilder()
            .select('id')
            .from('patient', 'p')
            .where('p.id = :id', { id })
            .getRawOne();
        return result;
    }

    public async findPatientByPhone(phone: string): Promise<{ id: string } | null> {
        const result = await this.dataSource
            .createQueryBuilder()
            .select('id')
            .from('patient', 'p')
            .where('p.phone = :phone', { phone })
            .getRawOne();
        return result;
    }

    public async listPatients(): Promise<Array<{ id: string, full_name: string, document_cpf: string, phone: string }>> {
        const result = await this.dataSource
            .createQueryBuilder()
            .select(['id', 'full_name', 'document_cpf', 'phone'])
            .from('patient', 'p')
            .getRawMany();
        return result;
    }

}