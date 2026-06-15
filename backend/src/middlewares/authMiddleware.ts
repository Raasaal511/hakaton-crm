import { FastifyRequest, FastifyReply } from "fastify";
import { AppError, ForbiddenError, NoAccessToken } from "../infra/libs/errors.js";
import jwt from 'jsonwebtoken'
import type { JwtPayload } from "../entities/auth/index.js";
import config from 'config'

const JWT_TOKEN = config.get<string>('jwt.token')

export async function authMiddleware(req: FastifyRequest, _: FastifyReply) {
    try {
        const token = req.headers['authorization']?.split(' ')[1]

        if (!token) throw new NoAccessToken()
        const user = jwt.verify(token, JWT_TOKEN) as JwtPayload

        if (!user) throw new ForbiddenError()
        req.user = { id: user.id, email: user.email }
    } catch (error) {
        if (error instanceof AppError)throw error  
        throw new NoAccessToken('Токен недействителен или истёк')
    }
}