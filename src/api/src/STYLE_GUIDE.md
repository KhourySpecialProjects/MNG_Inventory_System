# Backend Style Guide

## File and Function Names

**Files**

- camelCase.ts (e.g. authUtils.ts, awsUsers.ts)

**Functions**

- Start with verbs: getTeam(), createItem(), deleteRole()
- Helper functions: camelCase
- Constants: SCREAMING_SNAKE_CASE (TABLE_NAME, BUCKET_NAME)

## File Headers and Documentation

### When to Add File Headers

Add a JSDoc file header at the **top of every file** (before imports) that explains:

- What the module does
- Key responsibilities or features
- Any important context (security, environment-specific behavior)

```typescript
/**
 * Cookie management for authentication tokens
 *
 * Handles setting, clearing, and parsing auth cookies across Express and Lambda environments.
 *
 * **Cookie Security:**
 * - Production: SameSite=None; Secure=true (cross-site CORS)
 * - Development: SameSite=Lax; Secure=false (localhost)
 *
 * @module helpers/cookies
 */

import type { Response } from 'express';
// ... rest of file
```

### File Structure

Organize files in this order:

1. **File header** (JSDoc comment)
2. **Imports** (organized in groups)
3. **Configuration section** (constants)
4. **Type definitions**
5. **Helper functions**
6. **Exported functions** (public API)

### When to Add Comments vs. Section Groups

#### Use Section Separators (=== style) for:

- Major logical boundaries (configuration, types, helpers, public API)
- Grouping related functions (cookie parsing, cookie serialization)
- Marking different responsibility areas

```typescript
// ===========================================================
//                      Configuration
// ===========================================================

export const COOKIE_ACCESS = 'auth_access';
const DEFAULT_TOKEN_TTL = 3600;

// ===========================================================
//             Public API - Set/Clear Cookies
// ===========================================================

export function buildAuthSetCookies() {}
export function clearAuthCookies() {}
```

#### Use JSDoc Comments for:

- **All exported functions** (public API that other files will call)
- **Complex helper functions** with non-obvious behavior
- **Functions with important caveats** or edge cases

```typescript
/**
 * Build Set-Cookie headers for authentication tokens
 *
 * - Access/ID tokens use ExpiresIn (default: 1 hour)
 * - Refresh token lives for 1 day
 *
 * @param tokens - Authentication tokens from Cognito
 * @returns Array of Set-Cookie header strings
 */
export function setAuthCookies(tokens: AuthTokens): string[] {
  // implementation
}
```

#### Use Inline Comments (//) for:

- **Simple helper functions** that don't need full JSDoc
- **Quick context** on a specific line or block
- **Non-obvious business logic** that needs explanation

```typescript
// Serialize cookie with environment-aware security settings
function serializeCookie(name: string, value: string, maxAge?: number) {
  return cookie.serialize(name, value, baseCookieOpts(maxAge));
}

// API Gateway v2 supports both event.cookies[] and Cookie header
const fromArray = Array.isArray(ctx?.event?.cookies) ? ctx!.event!.cookies : [];
```

#### Skip Comments When:

- The code is **self-explanatory** (clear variable names, simple logic)
- The function name **clearly describes** what it does
- You're **repeating what the code says**

```typescript
// Bad - Comment adds no value

// Get the user ID
const userId = user.id;

// Good - No comment needed, code is clear

const userId = user.id;
```

### Comment Density Guidelines

- **Configuration/Constants**: Minimal comments (group with section header)
- **Helper Functions**: 1-2 line inline comments or none if obvious
- **Public API Functions**: Full JSDoc with @param & @returns
- **Complex Logic**: Inline comments explaining the "why" not the "what"
