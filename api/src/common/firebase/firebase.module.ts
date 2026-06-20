import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';

// Global para no tener que importarlo en cada modulo; firebase-admin es un singleton de facto.
@Global()
@Module({
  providers: [FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
