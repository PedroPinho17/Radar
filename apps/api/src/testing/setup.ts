import { Logger } from '@nestjs/common';

// Os testes simulam falhas de propósito (BD em baixo, SMTP a falhar…): sem isto o output enche-se de "ERROR".
Logger.overrideLogger(false);
