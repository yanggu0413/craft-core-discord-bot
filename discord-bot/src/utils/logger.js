const winston = require('winston');
const path = require('path');

// 1. Define Log Formats
// Standard JSON format for production and files
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Capture stack trace for Error objects
  winston.format.splat(), // Support string interpolation
  winston.format.json()
);

// Simple colorized format for local development console
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaString}${stack ? `\n${stack}` : ''}`;
  })
);

// 2. Select Logger Level and Environment Settings
const isTestEnv = process.env.NODE_ENV === 'test';
const isProdEnv = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || 'info';

const transports = [
  // Console Transport
  new winston.transports.Console({
    format: isProdEnv ? jsonFormat : consoleFormat,
    // Silences logging during unit tests inside Jest worker to keep clean outputs unless explicitly overridden.
    // Spawned E2E bot processes inherit JEST_WORKER_ID, so we check if 'jest' is in argv.
    silent: isTestEnv && process.env.JEST_WORKER_ID !== undefined && process.argv.some(arg => arg.includes('jest')) && !process.env.DEBUG_LOGS
  })
];

// File Transports (Only enabled when not running tests)
if (!isTestEnv) {
  transports.push(
    // Write all errors to error.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      format: jsonFormat
    }),
    // Write all combined logs to combined.log
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      format: jsonFormat
    })
  );
}

// 3. Create & Export Logger
const logger = winston.createLogger({
  level: logLevel,
  format: jsonFormat,
  transports: transports,
  exitOnError: false, // Ensure our process exception handlers handle the exit/graceful shutdown
  // Handle exceptions/rejections gracefully and log them
  exceptionHandlers: isTestEnv ? [] : [
    new winston.transports.File({ filename: path.join(__dirname, '../../logs/exceptions.log') }),
    new winston.transports.Console({ format: isProdEnv ? jsonFormat : consoleFormat })
  ],
  rejectionHandlers: isTestEnv ? [] : [
    new winston.transports.File({ filename: path.join(__dirname, '../../logs/rejections.log') }),
    new winston.transports.Console({ format: isProdEnv ? jsonFormat : consoleFormat })
  ]
});

module.exports = logger;
