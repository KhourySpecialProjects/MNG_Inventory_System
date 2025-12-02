// Handles Logout, Signin, checking new account, inviting user to the platform
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure, permissionedProcedure } from './trpc';
import {
  AdminCreateUserCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  MessageActionType,
  AuthFlowType,
  ChallengeNameType,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';
import { cognitoClient } from '../aws';
import { sendInviteEmail } from '../helpers/inviteEmail';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import {
  setAuthCookies,
  clearAuthCookies,
  parseCookiesFromCtx,
  emitCookiesToLambda,
  COOKIE_ACCESS,
} from '../helpers/cookies';
import { decodeJwtNoVerify } from '../helpers/authUtils';
import { ensureUserRecord } from '../helpers/awsUsers';
import { loadConfig } from '../process';

const config = loadConfig();
export const USER_POOL_ID = config.COGNITO_USER_POOL_ID;
export const USER_POOL_CLIENT_ID = config.COGNITO_CLIENT_ID;
export const SES_FROM_ADDRESS = config.SES_FROM;
export const APP_SIGNIN_URL = config.APP_SIGNIN_URL || `${config.WEB_URL}/signin`;

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  clientId: USER_POOL_CLIENT_ID,
  tokenUse: 'access',
});

// generates a temp password
const generateTempPassword = (): string => {
  return crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z]/g, '').slice(0, 16);
};

// handles invite user
const inviteUser = async (params: { email: string }) => {
  const { email } = params;
  const tempPassword = generateTempPassword();
  console.log('[Cognito] Generating a temp account for user ', email);

  try {
    // setting up account with temp pass
    await cognitoClient.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
    );

    await cognitoClient.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        Password: tempPassword,
        Permanent: false,
      }),
    );
    console.log(`[Cognito] Re-invited existing user: ${email}`);
  } catch (err: any) {
    if (err.name === 'UserNotFoundException') {
      await cognitoClient.send(
        new AdminCreateUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
          TemporaryPassword: tempPassword,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
          ],
          MessageAction: MessageActionType.SUPPRESS,
        }),
      );
      console.log(`[Cognito] Created new user: ${email}`);
    } else {
      throw err;
    }
  }

  // Custom SES invite with temp password
  await sendInviteEmail({ to: email, tempPassword, signinUrl: APP_SIGNIN_URL });

  return { success: true, email };
};

const signIn = async (params: { email: string; password: string }) => {
  const command = new AdminInitiateAuthCommand({
    UserPoolId: USER_POOL_ID,
    ClientId: USER_POOL_CLIENT_ID,
    AuthFlow: AuthFlowType.ADMIN_USER_PASSWORD_AUTH,
    AuthParameters: { USERNAME: params.email, PASSWORD: params.password },
  });
  return await cognitoClient.send(command);
};

export const authRouter = router({
  // invite user to the platform
  inviteUser: publicProcedure
    .input(
      z.object({
        email: z.email(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        console.log(`[Cognito] Inviting user via SES: ${input.email}`);

        const result = await inviteUser({
          email: input.email,
        });

        return {
          success: true,
          userEmail: result.email,
          message: 'User invited successfully - a custom SES email with credentials was sent.',
        };
      } catch (error: any) {
        console.error('Error inviting user:', error);

        if (error.name === 'UsernameExistsException') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'User already exists',
          });
        }
        if (error.name === 'InvalidParameterException') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid email format',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to invite user: ${error.message}`,
        });
      }
    }),
  // handle sign in
  signIn: publicProcedure
    .input(
      z.object({
        email: z.string(),
        password: z.string().min(10),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        console.log(`[Cognito] Sign in attempt for: ${input.email}`);

        const result = await signIn({
          email: input.email,
          password: input.password,
        });

        // Handle authentication challenges
        if (result.ChallengeName) {
          if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
            return {
              success: false,
              challengeName: result.ChallengeName,
              challengeParameters: result.ChallengeParameters,
              session: result.Session,
              message: 'Password change required',
            };
          }

          if (result.ChallengeName === 'EMAIL_OTP') {
            return {
              success: false,
              challengeName: result.ChallengeName,
              challengeParameters: result.ChallengeParameters,
              session: result.Session,
              message: 'MFA code sent to your email by Cognito',
            };
          }

          return {
            success: false,
            challengeName: result.ChallengeName,
            challengeParameters: result.ChallengeParameters,
            session: result.Session,
            message: 'Additional authentication step required',
          };
        }

        // Successful authentication - return tokens + set cookies
        if (result.AuthenticationResult) {
          // Set cookies for Express OR stash them for Lambda adapter
          const headers = setAuthCookies(ctx.res, {
            AccessToken: result.AuthenticationResult.AccessToken ?? null,
            IdToken: result.AuthenticationResult.IdToken ?? null,
            RefreshToken: result.AuthenticationResult.RefreshToken ?? null,
            ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
          });

          emitCookiesToLambda(ctx, headers);

          return {
            success: true,
            accessToken: result.AuthenticationResult.AccessToken,
            idToken: result.AuthenticationResult.IdToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            tokenType: result.AuthenticationResult.TokenType,
            expiresIn: result.AuthenticationResult.ExpiresIn,
            message: 'Sign in successful',
          };
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Unexpected authentication result',
        });
      } catch (error: any) {
        console.error('Error signing in user:', error);

        if (error.name === 'NotAuthorizedException') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid email or password',
          });
        }
        if (error.name === 'UserNotConfirmedException') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'User account not confirmed',
          });
        }
        if (error.name === 'PasswordResetRequiredException') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Password reset required',
          });
        }
        if (error.name === 'UserNotFoundException') {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Sign in failed: ${error.message}`,
        });
      }
    }),
  // checking if the password is a temp password or not
  respondToChallenge: publicProcedure
    .input(
      z
        .object({
          challengeName: z.string(),
          session: z.string(),
          newPassword: z.string().min(10).optional(),
          mfaCode: z.string().optional(),
          email: z.string(),
        })
        .refine(
          (data) => {
            const mfaChallenges = new Set(['EMAIL_OTP', 'SMS_MFA', 'SOFTWARE_TOKEN_MFA']);
            if (data.challengeName === 'NEW_PASSWORD_REQUIRED') {
              return !!data.newPassword;
            }
            if (mfaChallenges.has(data.challengeName)) {
              return !!data.mfaCode;
            }
            return true;
          },
          {
            message:
              'newPassword required for NEW_PASSWORD_REQUIRED; mfaCode required for EMAIL_OTP/SMS_MFA/SOFTWARE_TOKEN_MFA',
          },
        ),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // build ChallengeResponses
        const responses: Record<string, string> = { USERNAME: input.email };
        switch (input.challengeName) {
          case 'NEW_PASSWORD_REQUIRED':
            responses.NEW_PASSWORD = input.newPassword!;
            break;
          case 'EMAIL_OTP':
            responses.EMAIL_OTP_CODE = input.mfaCode!;
            break;
          case 'SMS_MFA':
            responses.SMS_MFA_CODE = input.mfaCode!;
            break;
          case 'SOFTWARE_TOKEN_MFA':
            responses.SOFTWARE_TOKEN_MFA_CODE = input.mfaCode!;
            break;
          default:
            break;
        }

        const command = new AdminRespondToAuthChallengeCommand({
          UserPoolId: USER_POOL_ID,
          ClientId: USER_POOL_CLIENT_ID,
          ChallengeName: input.challengeName as ChallengeNameType,
          Session: input.session,
          ChallengeResponses: responses,
        });

        const result = await cognitoClient.send(command);

        // More challenges
        if (result.ChallengeName) {
          return {
            success: false,
            challengeName: result.ChallengeName,
            challengeParameters: result.ChallengeParameters,
            session: result.Session,
            message: 'Additional authentication step required',
          };
        }

        // Success => set cookies
        if (result.AuthenticationResult) {
          const headers = setAuthCookies(ctx.res, {
            AccessToken: result.AuthenticationResult.AccessToken ?? null,
            IdToken: result.AuthenticationResult.IdToken ?? null,
            RefreshToken: result.AuthenticationResult.RefreshToken ?? null,
            ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
          });
          emitCookiesToLambda(ctx, headers);

          return {
            success: true,
            accessToken: result.AuthenticationResult.AccessToken,
            idToken: result.AuthenticationResult.IdToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            tokenType: result.AuthenticationResult.TokenType,
            expiresIn: result.AuthenticationResult.ExpiresIn,
            message:
              input.challengeName === 'NEW_PASSWORD_REQUIRED'
                ? 'Password updated and sign in successful'
                : 'MFA/OTP verification successful',
          };
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to respond to challenge',
        });
      } catch (error: any) {
        console.error('Error responding to challenge:', error);

        if (error.name === 'CodeMismatchException') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid code',
          });
        }
        if (error.name === 'ExpiredCodeException') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Code expired',
          });
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Challenge response failed: ${error.message}`,
        });
      }
    }),
  // finding out who is the user
  me: publicProcedure.query(async ({ ctx }) => {
    const cookies = parseCookiesFromCtx(ctx);
    const accessToken = cookies[COOKIE_ACCESS];

    if (!accessToken) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No access token',
      });
    }

    // verify token
    let decoded;
    try {
      decoded = await verifier.verify(accessToken);
    } catch (err: any) {
      console.error('[DynamoDB] me() token verification error:', err);
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
      });
    }

    const userId = decoded.sub;

    // look up user in dynamo
    const { doc } = await import('../aws');
    const { GetCommand, PutCommand } = await import('@aws-sdk/lib-dynamodb');
    const TABLE = config.TABLE_NAME;

    let user: any = null;

    try {
      const res = await doc.send(
        new GetCommand({
          TableName: TABLE,
          Key: { PK: `USER#${userId}`, SK: 'METADATA' },
        }),
      );
      user = res.Item || null;
    } catch (err) {
      console.error('[DynamoDB] me() DynamoDB Get error:', err);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user',
      });
    }

    // Create user if missing
    if (!user) {
      const now = new Date().toISOString();
      const username = 'user-' + Math.random().toString(36).substring(2, 8);
      const accountId = crypto.randomUUID();

      user = {
        PK: `USER#${userId}`,
        SK: 'METADATA',
        sub: userId,
        username,
        name: "",
        role: 'Owner',
        accountId,
        createdAt: now,
        updatedAt: now,
        GSI6PK: `UID#${userId}`,
        GSI6SK: `USER#${userId}`,
      };

      try {
        await doc.send(
          new PutCommand({
            TableName: TABLE,
            Item: user,
          }),
        );
        console.log('[DynamoDB] Created new DynamoDB user record:', user);
      } catch (err) {
        console.error('[DynamoDB] FAILED TO CREATE USER RECORD:', err);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not create user record',
        });
      }
    }

    // Return Profile
    return {
      authenticated: true,
      userId,
      name: user.name,
      username: user.username,
      role: user.role,
      accountId: user.accountId,
    };
  }),

  // getting a new token
  refresh: publicProcedure.mutation(async ({ ctx }) => {
    try {
      const cookies = parseCookiesFromCtx(ctx);
      const refreshToken = cookies['auth_refresh'];

      if (!refreshToken) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No refresh token',
        });
      }

      // Request New tokens from cognito 
      const cmd = new InitiateAuthCommand({
        ClientId: USER_POOL_CLIENT_ID,
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });

      let result;
      try {
        result = await cognitoClient.send(cmd);
      } catch (err: any) {
        console.error('[Cognito] refresh() Cognito error:', err);
        if (err.name === 'NotAuthorizedException') {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: 'Invalid or expired refresh token',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Token refresh failed: ${err.message}`,
        });
      }

      if (!result.AuthenticationResult) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Token refresh failed',
        });
      }

      // Set new cookies
      const headers = setAuthCookies(ctx.res, {
        AccessToken: result.AuthenticationResult.AccessToken ?? null,
        IdToken: result.AuthenticationResult.IdToken ?? null,
        ExpiresIn: result.AuthenticationResult.ExpiresIn ?? null,
      });
      emitCookiesToLambda(ctx, headers);

      // Decode new token
      const newAccess = result.AuthenticationResult.AccessToken;
      const newId = result.AuthenticationResult.IdToken;

      const decoded = decodeJwtNoVerify(newId) || decodeJwtNoVerify(newAccess);

      if (!decoded || !decoded.sub) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Token refresh succeeded but missing userId (sub)',
        });
      }

      const userId = decoded.sub;

      // Create or fix user records 
      const record = await ensureUserRecord({ sub: userId });

      return {
        refreshed: true,
        userId,
        username: record.username,
        accountId: record.accountId,
        authenticated: true,
        expiresIn: result.AuthenticationResult.ExpiresIn,
      };
    } catch (err) {
      console.error('refresh error:', err);
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Token refresh failed',
      });
    }
  }),
  // log out user
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    const headers = clearAuthCookies(ctx.res);
    emitCookiesToLambda(ctx, headers);
    return { success: true, message: 'Signed out' };
  }),
});
