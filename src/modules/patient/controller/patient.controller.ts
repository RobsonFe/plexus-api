import { Controller } from "@nestjs/common";
import { PatientRepository } from "../repository/patient.repository";
import { GrpcMethod } from "@nestjs/microservices";

@Controller('patient')
export class PatientController{
    constructor(private readonly patientRepository: PatientRepository) {}

    @GrpcMethod('GetPatient')
    public async getPatient(call: any, callback: any): Promise<void> {
        try {
            const patientId = call.request.patientId;
            const patient = await this.patientRepository.findPatientById(patientId);
            callback(null, { patient });
        } catch (error) {
            callback(error, null);
        }
    }

    @GrpcMethod('CreatePatient')
    public async createPatient(call: any, callback: any): Promise<void> {
        try {
            const patientData = call.request;
            const newPatient = await this.patientRepository.createPatient(patientData);
            callback(null, { patient: newPatient });
        } catch (error) {
            callback(error, null);
        }
    }

    @GrpcMethod('UpdatePatient')
    public async updatePatient(call: any, callback: any): Promise<void> {
        try {
            const patientData = call.request;
            await this.patientRepository.updatePatient(patientData);
            callback(null, { success: true });
        } catch (error) {
            callback(error, null);
        }
    }

    @GrpcMethod('DeletePatient')
    public async deletePatient(call: any, callback: any): Promise<void> {
        try {
            const patientId = call.request.patientId;
            await this.patientRepository.deletePatientByCpf(patientId);
            callback(null, { success: true });
        } catch (error) {
            callback(error, null);
        }  
    }

    @GrpcMethod('GetAllPatients')
    public async getAllPatients(call: any, callback: any): Promise<void> {
        try {
            const patients = await this.patientRepository.listPatients();
            callback(null, { patients });
        } catch (error) {
            callback(error, null);
        }
    }   

    @GrpcMethod('GetPatientByCpf')
    public async getPatientByCpf(call: any, callback: any): Promise<void> {
        try {
            const cpf = call.request.cpf;
            const patient = await this.patientRepository.findPatientByCpf(cpf);
            callback(null, { patient });
        } catch (error) {
            callback(error, null);
        }
    }
    @GrpcMethod('GetPatientById')
    public async getPatientById(call: any, callback: any): Promise<void> {
        try {
            const id = call.request.id;
            const patient = await this.patientRepository.findPatientById(id);
            callback(null, { patient });
        } catch (error) {
            callback(error, null);
        }
    }   

    @GrpcMethod('GetPatientByPhone')
    public async getPatientByPhone(call: any, callback: any): Promise<void> {
        try {
            const phone = call.request.phone;
            const patient = await this.patientRepository.findPatientByPhone(phone);
            callback(null, { patient });
        } catch (error) {
            callback(error, null);
        }
    }

    @GrpcMethod('ListPatients')
    public async listPatients(call: any, callback: any): Promise<void> {
        try {
            const patients = await this.patientRepository.listPatients();
            callback(null, { patients });
        } catch (error) {
            callback(error, null);
        }
    }

}