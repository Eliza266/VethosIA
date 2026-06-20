import { IsIn, IsString } from 'class-validator';
import { Rol } from '../../../common/auth/auth-user.interface';

export class AsignarMiembroDto {
  // uid de Firebase Auth del usuario a agregar a la org.
  @IsString()
  uid!: string;

  @IsIn(['admin', 'vet'])
  rol!: Exclude<Rol, 'superadmin' | 'asistente'>;
}
