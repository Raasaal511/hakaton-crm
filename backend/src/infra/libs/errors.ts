export class AppError extends Error {
    constructor(message: string,
        public readonly statusCode: number = 500) {
        super(message)
        this.name = 'AppError'
    }
}

export class NotFoundError extends AppError{
    constructor(message: string = 'Не найдено'){
        super(message, 404)
        this.name = 'NotFoundError'
    }
}

export class BadRequestError extends AppError{
    constructor(message: string = 'Неккоректные данныe'){
        super(message, 400)
        this.name = 'BadRequestError'
    }
}

export class NoAccessToken extends AppError{
    constructor(message: string = 'Отсутсвует токен!'){
        super(message, 401)
        this.name = 'NoAccessToken'
    }
}

export class ConflictError extends AppError {
    constructor(message: string = 'Конфликт данных') {
        super(message, 409)
        this.name = 'ConflictError'
    }
}

export class ForbiddenError extends AppError{
    constructor(message: string = 'У вас нет доступа!'){
        super(message, 403)
        this.name = 'ForbiddenError'
    }
}

export class RateLimitError extends AppError {
    constructor(message: string = 'Слишком много запросов. Попробуйте позже.') {
        super(message, 429)
        this.name = 'RateLimitError'
    }
}
