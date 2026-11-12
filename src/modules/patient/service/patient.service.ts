import { CreatePatientDto } from "../dto/create-patient.dto";
import { UpdatePatientDto } from "../dto/update-patient.dto";
import { PatientRepository } from "../repository/patient.repository";

export class PatientService{
    constructor(private readonly patientRepository: PatientRepository) {}

    public async createPatient(patient: CreatePatientDto): Promise<void> {
        await this.patientRepository.createPatient(patient);
    }

    public async findPatientByCpf(cpf: string): Promise<{ id: string } | null> {
        return await this.patientRepository.findPatientByCpf(cpf);
    }

    public async updatePatient(patient: UpdatePatientDto): Promise<void> {
        await this.patientRepository.updatePatient(patient);
    }

    public async deletePatientByCpf(cpf: string): Promise<void> {
        await this.patientRepository.deletePatientByCpf(cpf);
    }

    public async findPatientById(id: string): Promise<{ id: string } | null> {
        return await this.patientRepository.findPatientById(id);
    }

    public async findPatientByPhone(phone: string): Promise<{ id: string } | null> {
        return await this.patientRepository.findPatientByPhone(phone);
    }

    public async listPatients(): Promise<Array<{ id: string, full_name: string, document_cpf: string, phone: string }>> {
        return await this.patientRepository.listPatients();
    }
}