// Self-hosted replacements for the AWS services SupplyNet used to depend on.
// Turned on with SELF_HOSTED=true. Each export below accepts the same requests
// the AWS SDK clients did, so the routers keep working unchanged:
//
//   localCognito  - sign-in, invites, password changes and token refresh (replaces Cognito)
//   localVerifier - checks the app's own sign-in tokens (replaces aws-jwt-verify)
//   localSes      - sends email through Resend, or prints it to the log (replaces SES)
//   localLambda   - runs the two Python export scripts in this container (replaces Lambda)
//
// Login details are stored in the app's own DynamoDB table as items keyed
// PK = "AUTH#<email>", SK = "CREDENTIALS". Passwords are stored as scrypt hashes.

import crypto from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminSetUserPasswordCommand,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { InvokeCommand } from '@aws-sdk/client-lambda';
import { loadConfig } from '../process';

export const SELF_HOSTED = process.env.SELF_HOSTED === 'true';

const config = loadConfig();
const REGION = config.REGION || 'us-east-1';
const TABLE = config.TABLE_NAME;

const ACCESS_TTL_SECONDS = 60 * 60; // sign-in lasts 1 hour, then refreshes
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SESSION_TTL_SECONDS = 15 * 60; // time allowed to finish a sign-in step
const CODE_TTL_SECONDS = 10 * 60; // emailed sign-in codes last 10 minutes
const REQUIRE_EMAIL_CODE = process.env.REQUIRE_EMAIL_CODE === 'true';

const AUTH_SECRET = (() => {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (SELF_HOSTED) {
    console.warn(
      '[SelfHosted] AUTH_SECRET is missing or shorter than 32 characters. Using a random one, ' +
        'so everyone is signed out whenever the API restarts.',
    );
  }
  return crypto.randomBytes(32).toString('hex');
})();

if (SELF_HOSTED) {
  console.log(
    `[SelfHosted] Self-hosted mode on: login, email and exports run on this server. ` +
      `Email ${process.env.RESEND_API_KEY ? 'is sent through Resend' : 'is printed to this log (no RESEND_API_KEY)'}; ` +
      `emailed sign-in codes are ${REQUIRE_EMAIL_CODE ? 'on' : 'off'}.`,
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function awsError(name: string, message: string): Error {
  const err = new Error(message);
  err.name = name; // the routers check error.name, as they did with Cognito
  return err;
}

let _db: DynamoDBDocumentClient | null = null;
function db(): DynamoDBDocumentClient {
  if (!_db) {
    const endpoint = process.env.DYNAMODB_ENDPOINT;
    const client = new DynamoDBClient(
      endpoint
        ? {
            region: REGION,
            endpoint,
            credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
          }
        : { region: REGION },
    );
    _db = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return _db;
}

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

async function verifyPassword(password: string, stored?: string): Promise<boolean> {
  if (!stored) return false;
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })).toString(
    'base64url',
  );
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function readToken(token: string | undefined, use: string): Record<string, any> {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('Bad token signature');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.token_use !== use) throw new Error('Wrong token type');
  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Login details stored in DynamoDB
// ---------------------------------------------------------------------------

type Creds = {
  email: string;
  sub: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
  codeHash?: string;
  codeExpiresAt?: number;
  createdAt?: string;
};

const normEmail = (email: string) => String(email ?? '').trim().toLowerCase();
const credKey = (email: string) => ({ PK: `AUTH#${normEmail(email)}`, SK: 'CREDENTIALS' });

async function getCreds(email: string): Promise<Creds | null> {
  if (!email) return null;
  const res = await db().send(new GetCommand({ TableName: TABLE, Key: credKey(email) }));
  return (res.Item as Creds) ?? null;
}

async function putCreds(creds: Creds): Promise<void> {
  const now = new Date().toISOString();
  await db().send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        ...creds,
        ...credKey(creds.email),
        email: normEmail(creds.email),
        createdAt: creds.createdAt ?? now,
        updatedAt: now,
      },
    }),
  );
}

function issueTokens(creds: Creds, includeRefresh = true) {
  const claims = { sub: creds.sub, email: creds.email, 'cognito:username': creds.email };
  return {
    AccessToken: signToken({ ...claims, token_use: 'access' }, ACCESS_TTL_SECONDS),
    IdToken: signToken({ ...claims, token_use: 'id' }, ACCESS_TTL_SECONDS),
    ...(includeRefresh
      ? {
          RefreshToken: signToken(
            { sub: creds.sub, email: creds.email, token_use: 'refresh' },
            REFRESH_TTL_SECONDS,
          ),
        }
      : {}),
    ExpiresIn: ACCESS_TTL_SECONDS,
    TokenType: 'Bearer',
  };
}

const codeHash = (email: string, code: string) =>
  crypto.createHmac('sha256', AUTH_SECRET).update(`${normEmail(email)}:${code}`).digest('hex');

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  return `${(user ?? '').slice(0, 1)}***@${domain ?? ''}`;
}

function challengeSession(email: string, purpose: string): string {
  return signToken({ email, purpose, token_use: 'session' }, SESSION_TTL_SECONDS);
}

async function startEmailCode(creds: Creds) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await putCreds({
    ...creds,
    codeHash: codeHash(creds.email, code),
    codeExpiresAt: Math.floor(Date.now() / 1000) + CODE_TTL_SECONDS,
  });
  await sendMail({
    to: [creds.email],
    subject: 'Your SupplyNet sign-in code',
    text: `Your SupplyNet sign-in code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your SupplyNet sign-in code is <b>${code}</b>. It expires in 10 minutes.</p>`,
  });
  return {
    ChallengeName: 'EMAIL_OTP',
    ChallengeParameters: {
      CODE_DELIVERY_DELIVERY_MEDIUM: 'EMAIL',
      CODE_DELIVERY_DESTINATION: maskEmail(creds.email),
    },
    Session: challengeSession(creds.email, 'EMAIL_OTP'),
  };
}

async function afterPasswordAccepted(creds: Creds) {
  if (creds.mustChangePassword) {
    return {
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      ChallengeParameters: {
        USER_ID_FOR_SRP: creds.email,
        requiredAttributes: '[]',
        userAttributes: JSON.stringify({ email: creds.email }),
      },
      Session: challengeSession(creds.email, 'NEW_PASSWORD_REQUIRED'),
    };
  }
  if (REQUIRE_EMAIL_CODE) return startEmailCode(creds);
  return { AuthenticationResult: issueTokens(creds) };
}

// ---------------------------------------------------------------------------
// Cognito stand-in
// ---------------------------------------------------------------------------

export const localCognito = {
  async send(command: any): Promise<any> {
    const input = command?.input ?? {};

    if (command instanceof AdminInitiateAuthCommand) {
      const creds = await getCreds(input.AuthParameters?.USERNAME);
      const ok = creds && (await verifyPassword(input.AuthParameters?.PASSWORD ?? '', creds.passwordHash));
      if (!creds || !ok) throw awsError('NotAuthorizedException', 'Incorrect username or password.');
      return afterPasswordAccepted(creds);
    }

    if (command instanceof AdminRespondToAuthChallengeCommand) {
      let session: Record<string, any>;
      try {
        session = readToken(input.Session, 'session');
      } catch {
        throw awsError('NotAuthorizedException', 'Invalid session for the user, session is expired.');
      }
      if (session.purpose !== input.ChallengeName) {
        throw awsError('NotAuthorizedException', 'Invalid session for the user.');
      }
      const creds = await getCreds(session.email);
      if (!creds) throw awsError('UserNotFoundException', 'User does not exist.');

      if (input.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        const newPassword = String(input.ChallengeResponses?.NEW_PASSWORD ?? '');
        if (newPassword.length < 10) {
          throw awsError('InvalidPasswordException', 'Password must be at least 10 characters.');
        }
        const updated: Creds = {
          ...creds,
          passwordHash: await hashPassword(newPassword),
          mustChangePassword: false,
        };
        await putCreds(updated);
        return { AuthenticationResult: issueTokens(updated) };
      }

      if (input.ChallengeName === 'EMAIL_OTP') {
        const code = String(input.ChallengeResponses?.EMAIL_OTP_CODE ?? '').trim();
        const now = Math.floor(Date.now() / 1000);
        if (!creds.codeHash || !creds.codeExpiresAt || creds.codeExpiresAt < now) {
          throw awsError('ExpiredCodeException', 'Code expired.');
        }
        if (codeHash(creds.email, code) !== creds.codeHash) {
          throw awsError('CodeMismatchException', 'Invalid code.');
        }
        const cleared: Creds = { ...creds, codeHash: undefined, codeExpiresAt: undefined };
        await putCreds(cleared);
        return { AuthenticationResult: issueTokens(cleared) };
      }

      throw awsError('InvalidParameterException', `Unsupported challenge: ${input.ChallengeName}`);
    }

    if (command instanceof InitiateAuthCommand) {
      if (input.AuthFlow !== 'REFRESH_TOKEN_AUTH') {
        throw awsError('InvalidParameterException', `Unsupported auth flow: ${input.AuthFlow}`);
      }
      let payload: Record<string, any>;
      try {
        payload = readToken(input.AuthParameters?.REFRESH_TOKEN, 'refresh');
      } catch {
        throw awsError('NotAuthorizedException', 'Invalid Refresh Token');
      }
      const creds = await getCreds(payload.email);
      if (!creds || creds.sub !== payload.sub) {
        throw awsError('NotAuthorizedException', 'Invalid Refresh Token');
      }
      return { AuthenticationResult: issueTokens(creds, false) };
    }

    if (command instanceof AdminGetUserCommand) {
      const creds = await getCreds(input.Username);
      if (!creds) throw awsError('UserNotFoundException', 'User does not exist.');
      return {
        Username: creds.email,
        UserAttributes: [
          { Name: 'email', Value: creds.email },
          { Name: 'sub', Value: creds.sub },
        ],
        UserStatus: creds.mustChangePassword ? 'FORCE_CHANGE_PASSWORD' : 'CONFIRMED',
      };
    }

    if (command instanceof AdminSetUserPasswordCommand) {
      const creds = await getCreds(input.Username);
      if (!creds) throw awsError('UserNotFoundException', 'User does not exist.');
      await putCreds({
        ...creds,
        passwordHash: await hashPassword(String(input.Password ?? '')),
        mustChangePassword: !input.Permanent,
      });
      return {};
    }

    if (command instanceof AdminCreateUserCommand) {
      const email = normEmail(input.Username);
      if (!email) throw awsError('InvalidParameterException', 'Missing email');
      if (await getCreds(email)) throw awsError('UsernameExistsException', 'User account already exists.');
      const sub = crypto.randomUUID();
      const tempPassword = String(input.TemporaryPassword || crypto.randomBytes(12).toString('base64url'));
      await putCreds({
        email,
        sub,
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      });
      return {
        User: {
          Username: email,
          Attributes: [
            { Name: 'email', Value: email },
            { Name: 'sub', Value: sub },
          ],
        },
      };
    }

    throw awsError(
      'NotImplemented',
      `Self-hosted login doesn't support ${command?.constructor?.name ?? 'this request'}`,
    );
  },
};

// Checks the access token stored in the auth_access cookie.
export const localVerifier = {
  async verify(token: string): Promise<Record<string, any>> {
    return readToken(token, 'access');
  },
};

// ---------------------------------------------------------------------------
// Email stand-in
// ---------------------------------------------------------------------------

async function sendMail(message: {
  to: string[];
  from?: string;
  subject: string;
  text?: string;
  html?: string;
}): Promise<string> {
  const from = process.env.EMAIL_FROM || message.from || config.SES_FROM;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(
      `\n[SelfHosted email] Not sent, because RESEND_API_KEY isn't set. Contents:\n` +
        `  To: ${message.to.join(', ')}\n  Subject: ${message.subject}\n  ${message.text ?? ''}\n`,
    );
    return `logged-${Date.now()}`;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    }),
  });
  if (!res.ok) throw new Error(`Email send failed: ${res.status} ${await res.text()}`);
  const data: any = await res.json().catch(() => ({}));
  return data?.id ?? `sent-${Date.now()}`;
}

export const localSes = {
  async send(command: any): Promise<any> {
    if (!(command instanceof SendEmailCommand)) {
      throw awsError('NotImplemented', 'Unsupported email request');
    }
    const input: any = command.input ?? {};
    const simple = input.Content?.Simple ?? {};
    const id = await sendMail({
      to: input.Destination?.ToAddresses ?? [],
      from: input.FromEmailAddress,
      subject: simple.Subject?.Data ?? '(no subject)',
      text: simple.Body?.Text?.Data,
      html: simple.Body?.Html?.Data,
    });
    return { MessageId: id };
  },
};

// ---------------------------------------------------------------------------
// Export stand-in: runs the Python export scripts inside this container
// ---------------------------------------------------------------------------

const EXPORTS_DIR = process.env.EXPORTS_DIR || '/app/exports';

function runPython(args: string[], input: string, env: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'python3',
      args,
      { env, timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (stderr) console.log(`[Exports] ${stderr}`);
        if (err) return reject(new Error(`Export script failed: ${err.message}`));
        resolve(stdout);
      },
    );
    child.stdin?.end(input);
  });
}

export const localLambda = {
  async send(command: any): Promise<any> {
    if (!(command instanceof InvokeCommand)) {
      throw awsError('NotImplemented', 'Unsupported Lambda request');
    }
    const name = String(command.input?.FunctionName ?? '');
    const handler = name.includes('2404') ? '2404_handler.py' : 'inventory_handler.py';
    const payload: any = command.input?.Payload;
    const eventJson =
      typeof payload === 'string' ? payload : payload ? new TextDecoder().decode(payload) : '{}';

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      AWS_REGION: REGION,
      AWS_DEFAULT_REGION: REGION,
      TABLE_NAME: TABLE,
      UPLOADS_BUCKET: config.BUCKET_NAME,
      KMS_KEY_ARN: '',
      AWS_ENDPOINT_URL_DYNAMODB: process.env.DYNAMODB_ENDPOINT ?? '',
      AWS_ENDPOINT_URL_S3: process.env.S3_ENDPOINT ?? '',
      AWS_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? '',
      AWS_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? '',
      AWS_REQUEST_CHECKSUM_CALCULATION: 'when_required',
      AWS_RESPONSE_CHECKSUM_VALIDATION: 'when_required',
    };
    delete env.AWS_SESSION_TOKEN;

    const stdout = await runPython(
      [`${EXPORTS_DIR}/run_export.py`, `${EXPORTS_DIR}/${handler}`],
      eventJson,
      env,
    );

    const encoder = new TextEncoder();
    const errorAt = stdout.lastIndexOf('__ERROR__');
    if (errorAt !== -1) {
      return {
        StatusCode: 200,
        FunctionError: 'Unhandled',
        Payload: encoder.encode(stdout.slice(errorAt + '__ERROR__'.length).trim()),
      };
    }
    const resultAt = stdout.lastIndexOf('__RESULT__');
    if (resultAt === -1) {
      return {
        StatusCode: 200,
        FunctionError: 'Unhandled',
        Payload: encoder.encode(JSON.stringify({ errorMessage: 'Export script returned no result' })),
      };
    }
    return {
      StatusCode: 200,
      Payload: encoder.encode(stdout.slice(resultAt + '__RESULT__'.length).trim()),
    };
  },
};
