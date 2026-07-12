class AppError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500, isOperational = true, metadata = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.metadata = metadata;
    this.timestamp = new Date();
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, metadata = {}) {
    super(message, 'VALIDATION_ERROR', 400, true, metadata);
  }
}

class DatabaseError extends AppError {
  constructor(message, metadata = {}, isOperational = true) {
    super(message, 'DATABASE_ERROR', 500, isOperational, metadata);
  }
}

class WebSocketError extends AppError {
  constructor(message, metadata = {}, isOperational = true) {
    super(message, 'WEBSOCKET_ERROR', 503, isOperational, metadata);
  }
}

class NotFoundError extends AppError {
  constructor(message, metadata = {}) {
    super(message, 'NOT_FOUND_ERROR', 404, true, metadata);
  }
}

class PermissionError extends AppError {
  constructor(message, metadata = {}) {
    super(message, 'PERMISSION_ERROR', 403, true, metadata);
  }
}

class RateLimitError extends AppError {
  constructor(message, metadata = {}) {
    super(message, 'RATE_LIMIT_ERROR', 429, true, metadata);
  }
}

module.exports = {
  AppError,
  ValidationError,
  DatabaseError,
  WebSocketError,
  NotFoundError,
  PermissionError,
  RateLimitError
};
