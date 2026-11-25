import type { OidcConfigResponse, Requester } from '@logto/js'
import type { AuthContext } from './session'
import type { AuthStateStore, StoredSession } from './stateStore'
import { discoveryPath, fetchOidcConfig, fetchTokenByAuthorizationCode, generateSignInUri, generateSignOutUri, verifyAndParseCodeFromCallbackUri } from '@logto/js'
import { and, eq } from 'drizzle-orm'
import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose'
import { RESPONSE_CODES } from '@/constants/responseCodeMap'
import db from '@/db/pg/db'
import { logtoAccountRevocations, userIdentities, users } from '@/db/pg/schemas'
import { ResponseCodeError } from '@/errors/responseCode'
import { assertLogtoAccountValid } from './logtoAccountState'
import { createSessionManager, hashAuthValue as hash, randomAuthToken as randomBase64Url, toAuthUser as toUser } from './session'

export type { AuthContext, AuthUser } from './session'
export { SESSION_COOKIE_NAME } from './session'

export const LOGIN_COOKIE_NAME = 'yuumi_login'

export interface AuthManagerOptions {
  apiPrefix: string
  appOrigin: string
  clientId: string
  clientSecret: string
  endpoint: string
  fetch?: typeof fetch
  loginTtlSeconds: number
  loginCookieName?: string
  sessionCookieName?: string
  sessionIssuer?: string
  resource: string
  scope: string
  sessionTtlSeconds: number
  stateStore: AuthStateStore
}

interface IdentityProfile {
  email?: string
  emailVerified?: boolean
  image?: string
  name?: string
}

function safeReturnTo(input: string | undefined) {
  if (!input || !input.startsWith('/') || input.startsWith('//') || input.includes('\\')) {
    return '/'
  }
  const url = new URL(input, 'http://local.invalid')
  return `${url.pathname}${url.search}${url.hash}`
}

function textClaim(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function bearerToken(authorization: string | null) {
  const parts = authorization?.split(' ').filter(Boolean)
  if (parts?.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') { return undefined }
  return parts[1]
}

function unavailable(cause: unknown) {
  return new ResponseCodeError(RESPONSE_CODES.SERVICE_UNAVAILABLE, '', { cause })
}

export function createAuthManager(options: AuthManagerOptions) {
  const fetcher = options.fetch ?? fetch
  const callbackUri = `${options.appOrigin}${options.apiPrefix}/auth/callback/logto`
  const callbackPath = new URL(callbackUri).pathname
  const sessions = createSessionManager({
    ...options,
    findSessionUser: options.sessionIssuer ? findSessionUser : undefined,
  })
  const loginCookieName = options.loginCookieName ?? LOGIN_COOKIE_NAME
  const cookieSecure = new URL(options.appOrigin).protocol === 'https:'
  let discoveryPromise: Promise<OidcConfigResponse> | undefined
  let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

  const requester = (clientAuthenticated: boolean): Requester => async <T>(input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    if (clientAuthenticated) {
      headers.set('authorization', `Basic ${btoa(`${options.clientId}:${options.clientSecret}`)}`)
    }
    let response: Response
    try {
      response = await fetcher(input, { ...init, headers })
    }
    catch (error) {
      throw unavailable(error)
    }
    if (!response.ok) {
      const error = new Error(`Logto request failed with HTTP ${response.status}`)
      throw response.status >= 500 ? unavailable(error) : new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED, '', { cause: error })
    }
    return await response.json() as T
  }

  async function discovery() {
    discoveryPromise ??= fetchOidcConfig(`${options.endpoint}${discoveryPath}`, requester(false)).catch((error) => {
      discoveryPromise = undefined
      throw error
    })
    return discoveryPromise
  }

  async function verifyJwt(token: string, audience: string) {
    const oidc = await discovery()
    jwks ??= createRemoteJWKSet(new URL(oidc.jwksUri))
    try {
      return await jwtVerify(token, jwks, {
        audience,
        issuer: oidc.issuer,
        requiredClaims: ['aud', 'exp', 'iat', 'iss', 'sub'],
      })
    }
    catch (error) {
      if (error instanceof TypeError || error instanceof joseErrors.JWKSTimeout) {
        throw unavailable(error)
      }
      throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED, '', { cause: error })
    }
  }

  const revocationForSubject = and(
    eq(logtoAccountRevocations.provider, options.endpoint),
    eq(logtoAccountRevocations.subject, userIdentities.subject),
  )

  const identityFields = {
    revokedBefore: logtoAccountRevocations.revokedBefore,
    state: logtoAccountRevocations.state,
  }

  async function findSessionUser({ issuedAt, userId }: StoredSession) {
    const [row] = await db.select({ ...identityFields, user: users })
      .from(userIdentities)
      .innerJoin(users, eq(userIdentities.userId, users.id))
      .leftJoin(logtoAccountRevocations, revocationForSubject)
      .where(and(eq(userIdentities.userId, userId), eq(userIdentities.issuer, options.sessionIssuer!)))
      .limit(1)
    assertLogtoAccountValid(row, issuedAt)
    return row?.user
  }

  async function findIdentity(issuer: string, subject: string, issuedAt: number) {
    const [row] = await db.select({ ...identityFields, user: users })
      .from(userIdentities)
      .innerJoin(users, eq(userIdentities.userId, users.id))
      .leftJoin(logtoAccountRevocations, revocationForSubject)
      .where(and(eq(userIdentities.issuer, issuer), eq(userIdentities.subject, subject)))
      .limit(1)
    if (row) {
      assertLogtoAccountValid(row, issuedAt)
      return row.user
    }

    // 删除通知可能先于本地首次建档。
    const [revocation] = await db.select(identityFields)
      .from(logtoAccountRevocations)
      .where(and(eq(logtoAccountRevocations.provider, options.endpoint), eq(logtoAccountRevocations.subject, subject)))
      .limit(1)
    assertLogtoAccountValid(revocation, issuedAt)
  }

  async function ensureIdentity(issuer: string, subject: string, issuedAt: number, profile: IdentityProfile = {}) {
    const existing = await findIdentity(issuer, subject, issuedAt)
    const profileUpdate = {
      ...(profile.email === undefined ? {} : { email: profile.email }),
      ...(profile.emailVerified === undefined ? {} : { emailVerified: profile.emailVerified }),
      ...(profile.image === undefined ? {} : { image: profile.image }),
      ...(profile.name === undefined ? {} : { name: profile.name }),
    }
    if (existing) {
      if (Object.keys(profileUpdate).length === 0) { return existing }
      const [updated] = await db.update(users).set(profileUpdate).where(eq(users.id, existing.id)).returning()
      return updated ?? existing
    }

    const id = `usr_${hash(`${issuer}\0${subject}`).slice(0, 32)}`
    await db.transaction(async (tx) => {
      await tx.insert(users).values({ id, ...profile }).onConflictDoNothing({ target: users.id })
      await tx.insert(userIdentities).values({ issuer, subject, userId: id }).onConflictDoNothing({ target: [userIdentities.issuer, userIdentities.subject] })
    })
    const created = await findIdentity(issuer, subject, issuedAt)
    if (!created) { throw new Error('Failed to persist external identity') }
    return created
  }

  async function verifyAccessToken(token: string) {
    const result = await verifyJwt(token, options.resource)
    const issuer = textClaim(result.payload.iss)
    const subject = textClaim(result.payload.sub)
    const scopes = textClaim(result.payload.scope)?.split(/\s+/) ?? []
    const { iat } = result.payload
    if (!issuer || !subject || typeof iat !== 'number' || !scopes.includes(options.scope)) {
      throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED)
    }
    return { issuedAt: iat * 1000, issuer, subject }
  }

  return {
    async authenticate(request: Request): Promise<AuthContext> {
      const authorization = request.headers.get('authorization')
      if (authorization) {
        const token = bearerToken(authorization)
        if (!token) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
        const identity = await verifyAccessToken(token)
        const user = await findIdentity(identity.issuer, identity.subject, identity.issuedAt)
        if (!user) { throw new ResponseCodeError(RESPONSE_CODES.AUTH_IDENTITY_NOT_PROVISIONED) }
        return { method: 'bearer', user: toUser(user), userId: user.id }
      }

      return sessions.authenticate(request)
    },

    async completeLogin(request: Request) {
      const requestUrl = new URL(request.url)
      const state = requestUrl.searchParams.get('state')
      const browserState = new Bun.CookieMap(request.headers.get('cookie') ?? '').get(loginCookieName)
      if (!state || browserState !== state) { throw new ResponseCodeError(RESPONSE_CODES.BAD_REQUEST) }
      const transaction = await options.stateStore.consumeLogin(hash(state))
      if (!transaction) { throw new ResponseCodeError(RESPONSE_CODES.BAD_REQUEST) }
      let code: string
      try {
        if (requestUrl.pathname !== callbackPath) {
          throw new Error('OIDC callback path mismatch')
        }
        // 反向代理可以改写后端所见的 scheme/host；协议回调地址始终以配置的公开 Origin 为准。
        const publicCallbackUrl = new URL(callbackUri)
        publicCallbackUrl.search = requestUrl.search
        code = verifyAndParseCodeFromCallbackUri(publicCallbackUrl.href, callbackUri, state)
      }
      catch (error) {
        throw new ResponseCodeError(RESPONSE_CODES.BAD_REQUEST, '', { cause: error })
      }
      const oidc = await discovery()
      const token = await fetchTokenByAuthorizationCode({
        clientId: options.clientId,
        code,
        codeVerifier: transaction.codeVerifier,
        redirectUri: callbackUri,
        tokenEndpoint: oidc.tokenEndpoint,
      }, requester(true))
      const verified = await verifyJwt(token.idToken, options.clientId)
      if (verified.payload.nonce !== transaction.nonce || !verified.payload.sub) {
        throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED)
      }
      const issuedAt = Date.now()
      const user = await ensureIdentity(oidc.issuer, verified.payload.sub, issuedAt, {
        email: textClaim(verified.payload.email),
        emailVerified: verified.payload.email_verified === true,
        image: textClaim(verified.payload.picture),
        name: textClaim(verified.payload.name),
      })
      return {
        cookies: [
          await sessions.create(user.id, issuedAt),
          new Bun.Cookie(loginCookieName, '', {
            expires: new Date(0),
            httpOnly: true,
            maxAge: 0,
            path: '/',
            sameSite: 'lax',
            secure: cookieSecure,
          }).serialize(),
        ],
        returnTo: transaction.returnTo,
      }
    },

    async logout(request: Request) {
      sessions.requireOrigin(request)
      const oidc = await discovery()
      return {
        cookie: await sessions.clear(request),
        redirect: generateSignOutUri({ clientId: options.clientId, endSessionEndpoint: oidc.endSessionEndpoint, postLogoutRedirectUri: options.appOrigin }),
      }
    },

    async provision(request: Request) {
      const token = bearerToken(request.headers.get('authorization'))
      if (!token) { throw new ResponseCodeError(RESPONSE_CODES.UNAUTHORIZED) }
      const identity = await verifyAccessToken(token)
      const user = await ensureIdentity(identity.issuer, identity.subject, identity.issuedAt)
      return toUser(user)
    },

    async startLogin(returnTo?: string) {
      const oidc = await discovery()
      const state = randomBase64Url()
      const nonce = randomBase64Url()
      const codeVerifier = randomBase64Url(64)
      const codeChallenge = hash(codeVerifier)
      await options.stateStore.createLogin(hash(state), {
        codeVerifier,
        nonce,
        returnTo: safeReturnTo(returnTo),
      }, options.loginTtlSeconds)
      return {
        cookie: new Bun.Cookie(loginCookieName, state, {
          httpOnly: true,
          maxAge: options.loginTtlSeconds,
          path: '/',
          sameSite: 'lax',
          secure: cookieSecure,
        }).serialize(),
        redirect: generateSignInUri({
          authorizationEndpoint: oidc.authorizationEndpoint,
          clientId: options.clientId,
          codeChallenge,
          extraParams: { nonce },
          includeReservedScopes: false,
          redirectUri: callbackUri,
          scopes: ['openid', 'profile', 'email'],
          state,
        }),
      }
    },
  }
}

export type AuthManager = ReturnType<typeof createAuthManager>
