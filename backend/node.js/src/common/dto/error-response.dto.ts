export class ErrorResponseDto {
  code: string;
  message: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    this.code = code;
    this.message = message;
    if (details) {
      this.details = details;
    }
  }
}
