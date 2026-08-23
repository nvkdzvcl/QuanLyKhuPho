import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@quanlykhupho/shared-types';

export class AppException extends HttpException {
  public readonly errorCode?: ErrorCode;
  public readonly errors?: string[];

  constructor(
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    errorCode?: ErrorCode,
    errors?: string[],
  ) {
    super(
      {
        message,
        errorCode,
        errors,
      },
      status,
    );
    this.errorCode = errorCode;
    this.errors = errors;
  }
}
