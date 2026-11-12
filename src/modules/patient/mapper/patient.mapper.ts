import { CreatePatientDto } from "../dto/create-patient.dto";
import { UpdatePatientDto } from "../dto/update-patient.dto";

export class PatientMapper{
    public static toCreateDto(patient: { id: string, full_name: string, document_cpf: string, phone: string }): CreatePatientDto {
        return {
            fullName: patient.full_name,
            cpf: patient.document_cpf,
            phone: patient.phone
        };
    }

    public static toUpdateDto(patient: { id: string, full_name: string, document_cpf: string, phone: string }): UpdatePatientDto {
        return {
            fullName: patient.full_name,
            cpf: patient.document_cpf,
            phone: patient.phone
        };
    }
    
}