import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPatientsDeletedAt1794452947973 implements MigrationInterface {
  name = 'AddPatientsDeletedAt1794452947973';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "patients" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "patients" DROP COLUMN "deleted_at"`);
  }
}
