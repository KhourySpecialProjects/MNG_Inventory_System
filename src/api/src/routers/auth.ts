import { z } from 'zod';
import { router, publicProcedure } from './trpc';
import { CognitoService } from '../services/cognito.service';

const cognitoService = new CognitoService();

export const authRouter = router({
  /**
   * Invite a new user by sending them an email (admin only)
   */
  inviteUser: publicProcedure
    .input(
      z.object({
        email: z.email(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        console.log(`Inviting user: ${input.email}`);

        const result = await cognitoService.inviteUser({
          email: input.email,
        });

        return {
          success: true,
          userId: result.User?.Username,
          userStatus: result.User?.UserStatus,
          message: 'User invited successfully - they will receive an email with instructions',
        };
      } catch (error: any) {
        console.error('Error inviting user:', error);

        // Handle specific Cognito errors
        if (error.name === 'UsernameExistsException') {
          throw new Error('User already exists');
        }
        if (error.name === 'InvalidParameterException') {
          throw new Error('Invalid email format');
        }

        throw new Error(`Failed to invite user: ${error.message}`);
      }
    }),

  /**
   * Sign in an existing user
   */
  signIn: publicProcedure
    .input(
      z.object({
        email: z.email(),
        password: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        console.log(`Sign in attempt for: ${input.email}`);

        const result = await cognitoService.signIn({
          email: input.email,
          password: input.password,
        });

        // Handle authentication challenges (e.g., first-time login)
        if (result.ChallengeName) {
          return {
            success: false,
            challengeName: result.ChallengeName,
            challengeParameters: result.ChallengeParameters,
            session: result.Session,
            message: 'Additional authentication step required',
          };
        }

        // Successful authentication
        if (result.AuthenticationResult) {
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

        throw new Error('Unexpected authentication result');
      } catch (error: any) {
        console.error('Error signing in user:', error);

        // Handle specific authentication errors
        if (error.name === 'NotAuthorizedException') {
          throw new Error('Invalid email or password');
        }
        if (error.name === 'UserNotConfirmedException') {
          throw new Error('User account not confirmed');
        }
        if (error.name === 'PasswordResetRequiredException') {
          throw new Error('Password reset required');
        }
        if (error.name === 'UserNotFoundException') {
          throw new Error('User not found');
        }

        throw new Error(`Sign in failed: ${error.message}`);
      }
    }),

  /**
   * Handle authentication challenges (e.g., setting new password on first login)
   */
  respondToChallenge: publicProcedure
    .input(
      z.object({
        challengeName: z.string(),
        session: z.string(),
        newPassword: z.string().min(10),
        email: z.email(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await cognitoService.respondToChallenge({
          challengeName: input.challengeName,
          session: input.session,
          newPassword: input.newPassword,
          email: input.email,
        });

        if (result.AuthenticationResult) {
          return {
            success: true,
            accessToken: result.AuthenticationResult.AccessToken,
            idToken: result.AuthenticationResult.IdToken,
            refreshToken: result.AuthenticationResult.RefreshToken,
            tokenType: result.AuthenticationResult.TokenType,
            expiresIn: result.AuthenticationResult.ExpiresIn,
            message: 'Password updated and sign in successful',
          };
        }

        throw new Error('Failed to respond to challenge');
      } catch (error: any) {
        console.error('Error responding to challenge:', error);
        throw new Error(`Challenge response failed: ${error.message}`);
      }
    }),
});
