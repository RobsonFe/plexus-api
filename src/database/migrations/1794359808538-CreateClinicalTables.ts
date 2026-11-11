import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateClinicalTables1794359808538 implements MigrationInterface {
    name = 'CreateClinicalTables1794359808538'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "patients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying(255) NOT NULL, "document_cpf" character varying(14) NOT NULL, "phone" character varying(20) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_7657d4eb02aaacbeccf38319b38" UNIQUE ("document_cpf"), CONSTRAINT "PK_a7f0b9fcbb3469d5ec0b0aceaa7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "medical_files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "record_id" uuid NOT NULL, "original_name" character varying(255) NOT NULL, "mime_type" character varying(100) NOT NULL, "disk_path" text NOT NULL, "size_bytes" bigint NOT NULL DEFAULT '0', "status" character varying(50) NOT NULL DEFAULT 'uploading', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_90508a174a3d619caba0b63be94" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "clinical_records" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "patient_id" uuid NOT NULL, "doctor_notes" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_88bb9264ee0dcf6cea9c92d07d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "medical_files" ADD CONSTRAINT "FK_11e102bec35c4c6438ceef1b11b" FOREIGN KEY ("record_id") REFERENCES "clinical_records"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "clinical_records" ADD CONSTRAINT "FK_eb74d4b2b8f0df15f578a5634c5" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "clinical_records" DROP CONSTRAINT "FK_eb74d4b2b8f0df15f578a5634c5"`);
        await queryRunner.query(`ALTER TABLE "medical_files" DROP CONSTRAINT "FK_11e102bec35c4c6438ceef1b11b"`);
        await queryRunner.query(`DROP TABLE "clinical_records"`);
        await queryRunner.query(`DROP TABLE "medical_files"`);
        await queryRunner.query(`DROP TABLE "patients"`);
    }

}
