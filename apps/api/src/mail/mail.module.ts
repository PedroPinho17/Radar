import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { MonitorService } from './monitor.service.js';

@Global() // qualquer módulo pode injetar o MailService e o MonitorService sem importar
@Module({ providers: [MailService, MonitorService], exports: [MailService, MonitorService] })
export class MailModule {}
