export class RegisterRequestDto {
  email: string;
  password: string;
  fullName: string;
  company: string;
  position: string;
  phone?: string;
  ruc?: string;
  sector?: string;
  location?: string;
  description?: string;
  role?: 'buyer' | 'supplier';
}
