import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ErrorResponseDto;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && 'code' in exceptionResponse) {
        // Custom error response
        errorResponse = exceptionResponse as ErrorResponseDto;
      } else if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
        // Validation error
        errorResponse = new ErrorResponseDto(
          'VALIDATION_ERROR',
          Array.isArray((exceptionResponse as any).message)
            ? (exceptionResponse as any).message.join(', ')
            : (exceptionResponse as any).message,
          (exceptionResponse as any).error,
        );
      } else {
        errorResponse = new ErrorResponseDto(
          'HTTP_ERROR',
          exception.message,
        );
      }
    } else if (exception instanceof Error) {
      errorResponse = new ErrorResponseDto(
        'INTERNAL_ERROR',
        exception.message,
      );
    } else {
      errorResponse = new ErrorResponseDto(
        'UNKNOWN_ERROR',
        'An unknown error occurred',
      );
    }

    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${errorResponse.message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json(errorResponse);
  }
}
