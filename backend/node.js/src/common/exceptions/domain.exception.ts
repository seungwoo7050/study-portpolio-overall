import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorResponseDto } from '../dto/error-response.dto';

export class DomainException extends HttpException {
  constructor(code: string, message: string, status: HttpStatus = HttpStatus.BAD_REQUEST) {
    super(new ErrorResponseDto(code, message), status);
  }
}

export class NotFoundException extends DomainException {
  constructor(resource: string, id?: string | number) {
    super(
      `${resource.toUpperCase()}_NOT_FOUND`,
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class UnauthorizedException extends DomainException {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', message, HttpStatus.UNAUTHORIZED);
  }
}

export class ForbiddenException extends DomainException {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', message, HttpStatus.FORBIDDEN);
  }
}

export class ConflictException extends DomainException {
  constructor(message: string) {
    super('CONFLICT', message, HttpStatus.CONFLICT);
  }
}
