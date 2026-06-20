import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { loadAppConfig } from '../config/env';

// Wrapper fino sobre firebase-admin. Lo inyectamos en repos/servicios en vez de
// tocar el SDK global por todos lados, asi en tests podemos mockear esta clase.
@Injectable()
export class FirebaseService implements OnModuleInit {
  private app!: admin.app.App;

  onModuleInit(): void {
    this.init();
  }

  // Idempotente: si ya hay una app inicializada (p.ej. en tests) la reusamos.
  // Cuando FIRESTORE_EMULATOR_HOST esta seteado, el SDK apunta solo a los emuladores.
  init(): admin.app.App {
    if (this.app) return this.app;
    if (admin.apps.length > 0 && admin.apps[0]) {
      this.app = admin.apps[0];
      return this.app;
    }
    const cfg = loadAppConfig();
    this.app = admin.initializeApp({
      projectId: cfg.projectId,
      storageBucket: cfg.storageBucket,
    });
    return this.app;
  }

  get firestore(): admin.firestore.Firestore {
    return this.init().firestore();
  }

  get auth(): admin.auth.Auth {
    return this.init().auth();
  }

  get storage(): admin.storage.Storage {
    return this.init().storage();
  }

  bucket(): ReturnType<admin.storage.Storage['bucket']> {
    return this.storage.bucket();
  }
}
