import { ValidateBy } from 'class-validator';

/**
 * Valida se o valor é um CPF com 11 dígitos, sem sequência repetida e com dígitos verificadores corretos.
 *
 * @returns Decorator de propriedade para uso em DTOs
 */
export function IsCpf(): PropertyDecorator {
  return ValidateBy({
    name: 'isCpf',
    validator: {
      validate: (value: unknown): boolean => {
        if (typeof value !== 'string' || !/^\d{11}$/.test(value) || /^(\d)\1{10}$/.test(value)) {
          return false;
        }

        const digits = Array.from(value, Number);

        return [9, 10].every((length) => {
          const sum = digits
            .slice(0, length)
            .reduce((total, digit, index) => total + digit * (length + 1 - index), 0);
          return ((sum * 10) % 11) % 10 === digits[length];
        });
      },
      defaultMessage: () => '$property deve ser um CPF válido',
    },
  });
}
