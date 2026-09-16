import { Module } from '@nestjs/common';
import { OBJECT_STORAGE } from './interfaces/object-storage.interface';
import { R2StorageService } from './r2-storage.service';

@Module({
  providers: [{ provide: OBJECT_STORAGE, useClass: R2StorageService }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
