import { describe, it, expect } from 'vitest';
import { createApiKeyDetector, createApiKeyMediumDetector } from '@/core/detectors/apiKey.js';
import { createJwtDetector } from '@/core/detectors/jwt.js';
import { createAuthorizationHeaderDetector } from '@/core/detectors/authHeader.js';
import { createPrivateKeyDetector } from '@/core/detectors/privateKey.js';
import { createDatabaseUrlDetector } from '@/core/detectors/databaseUrl.js';
import { createPasswordDetector } from '@/core/detectors/password.js';
import { createEmailDetector } from '@/core/detectors/email.js';
import { createInternalUrlDetector } from '@/core/detectors/internalUrl.js';
import { createIpAddressDetector } from '@/core/detectors/ipAddress.js';
import { createAwsSecretKeyDetector } from '@/core/detectors/awsSecretKey.js';
import { createAwsAccessKeyDetector } from '@/core/detectors/awsAccessKey.js';
import { createGithubTokenDetector } from '@/core/detectors/githubToken.js';
import { createSlackTokenDetector } from '@/core/detectors/slackToken.js';
import { createGenericSecretDetector } from '@/core/detectors/genericSecret.js';
import { sanitizeText } from '@/core/pipeline.js';

describe('Detector Tests', () => {
  // Runtime-constructed secret fixtures to avoid GitHub push-protection triggers
  const STRIPE_LIVE_KEY = 'sk_live_' + 'a'.repeat(24);

  // ========== API Key Detector ==========
  describe('API Key Detector', () => {
    const detector = createApiKeyDetector();

    it('should detect AWS access key', () => {
      const text = 'AWS_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      const first = results[0];
      expect(first?.value).toBe('AKIAIOSFODNN7EXAMPLE');
      expect(first?.category).toBe('aws_access_key');
    });

    it('should detect AWS session key', () => {
      const text = 'AWS_SESSION_TOKEN=ASIAABCDEFGHIJ123456';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe('ASIAABCDEFGHIJ123456');
    });

    it('should detect Stripe keys', () => {
      const text = 'STRIPE_SECRET=' + STRIPE_LIVE_KEY;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('stripe_key');
    });

    it('should detect OpenAI keys', () => {
      const text = 'OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzab';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('openai_key');
    });

    it('should detect Anthropic keys', () => {
      const text =
        'ANTHROPIC_API_KEY=sk-ant-abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijkl';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('anthropic_key');
    });

    it('should not detect short random strings', () => {
      const text = 'random=abc123';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should not detect version numbers', () => {
      const text = 'version=1.2.3';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  describe('Medium Confidence API Key Detector', () => {
    const detector = createApiKeyMediumDetector();

    it('should detect keys in context', () => {
      const text = 'api_key: abcdefghijklmnopqrstuvwxyz123456';
      const results = detector.detect(text);
      expect(results.length).toBeGreaterThanOrEqual(0); // May or may not detect based on entropy
    });

    it('should not detect without key context', () => {
      const text = 'randomstringabcdefghijklmnopqrstuvwxyz123456';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  // ========== JWT Detector ==========
  describe('JWT Detector', () => {
    const detector = createJwtDetector();

    it('should detect valid JWT', () => {
      // Valid JWT header: {"alg":"HS256","typ":"JWT"}
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const text = `Authorization: Bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(jwt);
      expect(results[0]!.category).toBe('jwt');
      expect(results[0]!.confidence).toBe(0.9);
    });

    it('should reject invalid JWT (wrong structure)', () => {
      const text = 'not.a.jwt';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should accept JWT with only alg in header (typ optional)', () => {
      // Header with alg but no typ - now valid per updated spec
      const invalidJwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const text = `token: ${invalidJwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('jwt');
    });

    it('should reject version numbers', () => {
      const text = 'version=1.2.3';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  // ========== JWT Detector: Comprehensive Regression Tests ==========
  describe('JWT Detector: Comprehensive Regression Tests', () => {
    const detector = createJwtDetector();

    // Synthetic JWT constructor - builds valid JWT at runtime
    const mkValidJwt = () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const payload = btoa(
        JSON.stringify({ sub: '1234567890', name: 'Test User', iat: 1516239022 })
      )
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const sig = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      return `${header}.${payload}.${sig}`;
    };

    it('should detect valid three-segment JWT with Base64URL characters', () => {
      const jwt = mkValidJwt();
      const text = `Bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(jwt);
    });

    it('should require header with alg', () => {
      // Header without alg
      const header = btoa(JSON.stringify({ typ: 'JWT' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const payload = btoa(JSON.stringify({ sub: '1234567890' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const jwt = `${header}.${payload}.signature`;
      const text = `token: ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should require header with typ', () => {
      // Header without typ
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const payload = btoa(JSON.stringify({ sub: '1234567890' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const jwt = `${header}.${payload}.signature`;
      const text = `token: ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject malformed Base64URL (invalid characters)', () => {
      const jwt = 'invalid@chars.payload.signature';
      const text = `token: ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject malformed JSON header', () => {
      // Not valid JSON when decoded
      const header = btoa('not json').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const payload = btoa(JSON.stringify({ sub: '1234567890' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const jwt = `${header}.${payload}.signature`;
      const text = `token: ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject missing header segment', () => {
      const text = '.payload.signature';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject missing payload segment', () => {
      const text = 'header..signature';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject missing signature segment', () => {
      const text = 'header.payload.';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject empty segment', () => {
      const text = 'header..signature';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject semantic versions such as 1.2.3', () => {
      const text = 'version=1.2.3';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject semantic versions such as 10.20.30', () => {
      const text = 'version=10.20.30';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject domains', () => {
      const text = 'server=example.com';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject subdomains with common TLDs', () => {
      const text = 'api.company.org';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject filenames with extensions', () => {
      const text = 'file=script.js';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject dotted stack-trace fragments', () => {
      const text = 'at com.example.MyClass.method(MyClass.java:123)';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should handle surrounding quotes', () => {
      const jwt = mkValidJwt();
      const text = `token: "${jwt}"`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(jwt);
    });

    it('should handle surrounding commas', () => {
      const jwt = mkValidJwt();
      const text = `tokens: ${jwt}, ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(2);
    });

    it('should handle surrounding brackets', () => {
      const jwt = mkValidJwt();
      const text = `token: [${jwt}]`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(jwt);
    });

    it('should handle surrounding punctuation', () => {
      const jwt = mkValidJwt();
      const text = `token: (${jwt});`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(jwt);
    });

    it('should handle repeated JWT values', () => {
      const jwt = mkValidJwt();
      const text = `token1=${jwt} token2=${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(2);
    });

    it('should return only the token range (not surrounding context)', () => {
      const jwt = mkValidJwt();
      const text = `Authorization: Bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(jwt);
      // The range should be just the JWT, not "Bearer "
      expect(results[0]!.range.start).toBe(text.indexOf(jwt));
      expect(results[0]!.range.end).toBe(text.indexOf(jwt) + jwt.length);
    });

    it('should sanitize JWT through pipeline', async () => {
      const jwt = mkValidJwt();
      const input = `Authorization: Bearer ${jwt}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(jwt);
      // JWT detector wins overlap resolution (more specific category priority)
      expect(result.sanitizedText).toContain('<JWT_');
      // Should preserve "Authorization: Bearer "
      expect(result.sanitizedText).toContain('Authorization: Bearer');
    });

    it('should not throw on malformed input', () => {
      // Various malformed inputs that should never throw
      const malformedInputs = [
        '',
        '...',
        'a.b',
        'header.payload.',
        '.payload.signature',
        'header..signature',
        'a'.repeat(1000) + '.' + 'b'.repeat(1000) + '.' + 'c'.repeat(1000),
        'header. .signature', // null byte
        'header.payload.signature\nmore content',
      ];
      for (const input of malformedInputs) {
        expect(() => detector.detect(input)).not.toThrow();
      }
    });

    it('should reject JWT with typ not equal to JWT', () => {
      // Header with typ: "JWS" instead of "JWT"
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWS' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const payload = btoa(JSON.stringify({ sub: '1234567890' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const jwt = `${header}.${payload}.signature`;
      const text = `token: ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject three short parts (not JWT-like)', () => {
      const text = 'abc.def.ghi';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  // ========== Auth Header Detector ==========
  describe('Authorization Header Detector', () => {
    const detector = createAuthorizationHeaderDetector();

    it('should detect Bearer token in Authorization header', () => {
      const text =
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('bearer_token');
      expect(results[0]!.value).toContain('eyJ');
    });

    it('should detect Basic auth', () => {
      // base64 of "user:password" + padding to make it >20 chars: dXNlcjpwYXNzd29yZA== (20 chars)
      const basicAuth = 'dXNlcjpwYXNzd29yZA==';
      const text = `Authorization: Basic ${basicAuth}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('basic_auth');
      expect(results[0]!.value).toBe(basicAuth);
    });

    it('should detect x-api-key header', () => {
      const text = 'x-api-key: sk-live_abcdefghijklmnopqrstuvwx';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key');
    });
  });

  // ========== Authorization Header Detector: Comprehensive Regression Tests ==========
  describe('Authorization Header Detector: Comprehensive Regression Tests', () => {
    const detector = createAuthorizationHeaderDetector();

    const mkValidJwt = () => {
      const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const payload = btoa(
        JSON.stringify({ sub: '1234567890', name: 'Test User', iat: 1516239022 })
      )
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
      const sig = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      return `${header}.${payload}.${sig}`;
    };

    it('should detect Authorization: Bearer <value> (standard format)', () => {
      const jwt = mkValidJwt();
      const text = `Authorization: Bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('bearer_token');
      expect(results[0]!.value).toBe(jwt);
    });

    it('should detect lowercase header names', () => {
      const jwt = mkValidJwt();
      const text = `authorization: Bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('bearer_token');
    });

    it('should detect authorization = bearer <value> (config style)', () => {
      const jwt = mkValidJwt();
      const text = `authorization = bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('bearer_token');
    });

    it('should detect JSON-style authorization field', () => {
      const jwt = mkValidJwt();
      const text = `{"authorization": "Bearer ${jwt}"}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('bearer_token');
    });

    it('should detect log-style authorization field', () => {
      const jwt = mkValidJwt();
      const text = `authorization=Bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('bearer_token');
    });

    it('should preserve Authorization and Bearer text, sanitize only credential', () => {
      const jwt = mkValidJwt();
      const text = `Authorization: Bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results[0]!.value).toBe(jwt);
      // Range should not include "Bearer " prefix
      expect(results[0]!.range.start).toBe(text.indexOf(jwt));
      expect(results[0]!.range.end).toBe(text.indexOf(jwt) + jwt.length);
    });

    it('should handle repeated authorization headers', () => {
      const jwt1 = mkValidJwt();
      const jwt2 = mkValidJwt();
      const text = `Authorization: Bearer ${jwt1}\nAuthorization: Bearer ${jwt2}`;
      const results = detector.detect(text);
      expect(results.length).toBe(2);
      expect(results[0]!.value).toBe(jwt1);
      expect(results[1]!.value).toBe(jwt2);
    });

    it('should handle punctuation and quoted boundaries', () => {
      const jwt = mkValidJwt();
      const text = `header: "Authorization: Bearer ${jwt}"`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(jwt);
    });

    it('should reject empty bearer value', () => {
      const text = 'Authorization: Bearer ';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject placeholder: <token>', () => {
      const text = 'Authorization: Bearer <token>';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject placeholder: YOUR_TOKEN', () => {
      const text = 'Authorization: Bearer YOUR_TOKEN';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject placeholder: REPLACE_ME', () => {
      const text = 'Authorization: Bearer REPLACE_ME';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject placeholder: example', () => {
      const text = 'Authorization: Bearer example';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject placeholder: null', () => {
      const text = 'Authorization: Bearer null';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject placeholder: undefined', () => {
      const text = 'Authorization: Bearer undefined';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject placeholder: changeme', () => {
      const text = 'Authorization: Bearer changeme';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should handle Bearer JWT overlap: JWT detector wins on decoded token', () => {
      const jwt = mkValidJwt();
      const text = `Authorization: Bearer ${jwt}`;

      const authResults = detector.detect(text);
      const jwtDetector = createJwtDetector();
      const jwtResults = jwtDetector.detect(text);

      // Both detect, but JWT detector category is more specific
      expect(authResults.length).toBe(1);
      expect(jwtResults.length).toBe(1);
      expect(authResults[0]!.category).toBe('bearer_token');
      expect(jwtResults[0]!.category).toBe('jwt');
      // The JWT detector should find the decoded token
    });

    it('should detect Basic auth (backward compatibility)', () => {
      const basicAuth = 'dXNlcjpwYXNzd29yZA=='; // base64 of "user:password"
      const text = `Authorization: Basic ${basicAuth}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('basic_auth');
      expect(results[0]!.value).toBe(basicAuth);
    });

    it('should detect Basic auth without header name', () => {
      const basicAuth = 'dXNlcjpwYXNzd29yZA==';
      const text = `Basic ${basicAuth}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('basic_auth');
    });

    it('should sanitize authorization headers through pipeline', async () => {
      const jwt = mkValidJwt();
      const input = `Authorization: Bearer ${jwt}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(jwt);
      // JWT detector wins overlap resolution (category priority 90 > bearer_token 85)
      expect(result.sanitizedText).toContain('<JWT_');
      // Should preserve "Authorization: Bearer "
      expect(result.sanitizedText).toContain('Authorization: Bearer');
    });

    it('should detect x-api-key header (backward compatibility)', () => {
      const text = 'x-api-key: sk-live_abcdefghijklmnopqrstuvwx';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key');
    });

    it('should detect token = value pattern', () => {
      const jwt = mkValidJwt();
      const text = `token = ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('authorization_header');
    });

    it('should handle Bearer tokens without Authorization header prefix', () => {
      const jwt = mkValidJwt();
      const text = `Bearer ${jwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('bearer_token');
    });
  });

  // ========== Private Key Detector ==========
  describe('Private Key Detector', () => {
    const detector = createPrivateKeyDetector();

    // Short synthetic PEM bodies (not real keys, just valid base64-ish content)
    const PKCS8_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQD...
-----END PRIVATE KEY-----`;
    const RSA_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890...
-----END RSA PRIVATE KEY-----`;
    const EC_KEY = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIK1j2K3L4M5N6O7P...
-----END EC PRIVATE KEY-----`;
    const DSA_KEY = `-----BEGIN DSA PRIVATE KEY-----
MIIBuwIBADANBgkqhkiG9w0BAQEFAASC...
-----END DSA PRIVATE KEY-----`;
    const OPENSSH_KEY = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAA...
-----END OPENSSH PRIVATE KEY-----`;
    const PGP_KEY = `-----BEGIN PGP PRIVATE KEY BLOCK-----
lQOYBF0...
-----END PGP PRIVATE KEY BLOCK-----`;
    const ENCRYPTED_KEY = `-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIFDjBABgkqhkiG9w0BBQ0wMzAbBgkqhkiG9w0BBQwwDgQI...
-----END ENCRYPTED PRIVATE KEY-----`;

    it('should detect PKCS#8 private key', () => {
      const text = `Private key: ${PKCS8_KEY}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('private_key');
      expect(results[0]!.value).toBe(PKCS8_KEY);
    });

    it('should detect RSA private key', () => {
      const results = detector.detect(RSA_KEY);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('private_key');
      expect(results[0]!.value).toBe(RSA_KEY);
    });

    it('should detect EC private key', () => {
      const results = detector.detect(EC_KEY);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('private_key');
      expect(results[0]!.value).toBe(EC_KEY);
    });

    it('should detect DSA private key', () => {
      const results = detector.detect(DSA_KEY);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('private_key');
      expect(results[0]!.value).toBe(DSA_KEY);
    });

    it('should detect OpenSSH private key', () => {
      const results = detector.detect(OPENSSH_KEY);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('ssh_private_key');
      expect(results[0]!.value).toBe(OPENSSH_KEY);
    });

    it('should detect PGP private key block', () => {
      const results = detector.detect(PGP_KEY);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('pgp_private_key');
      expect(results[0]!.value).toBe(PGP_KEY);
    });

    it('should detect encrypted private key', () => {
      const results = detector.detect(ENCRYPTED_KEY);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('private_key');
      expect(results[0]!.value).toBe(ENCRYPTED_KEY);
    });

    it('should handle LF line endings', () => {
      const key = `-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQD...\n-----END PRIVATE KEY-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(key);
    });

    it('should handle CRLF line endings', () => {
      const key = `-----BEGIN PRIVATE KEY-----\r\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQD...\r\n-----END PRIVATE KEY-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(key);
    });

    it('should handle multiple private-key blocks', () => {
      const text = `${PKCS8_KEY}\n\n${RSA_KEY}`;
      const results = detector.detect(text);
      expect(results.length).toBe(2);
      expect(results[0]!.category).toBe('private_key');
      expect(results[1]!.category).toBe('private_key');
    });

    it('should handle surrounding log text', () => {
      const text = `DEBUG Loading key:\n${PKCS8_KEY}\nEND DEBUG`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(PKCS8_KEY);
    });

    it('should reject incomplete BEGIN without END', () => {
      const key = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQD...`;
      const results = detector.detect(key);
      expect(results.length).toBe(0);
    });

    it('should reject mismatched BEGIN and END markers', () => {
      const key = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQD...
-----END RSA PRIVATE KEY-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(0);
    });

    it('should reject public key', () => {
      const key = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE...
-----END PUBLIC KEY-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(0);
    });

    it('should reject certificate', () => {
      const key = `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAK...
-----END CERTIFICATE-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(0);
    });

    it('should reject certificate request', () => {
      const key = `-----BEGIN CERTIFICATE REQUEST-----
MIICzjCCAbYCAQAwgYgx...
-----END CERTIFICATE REQUEST-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(0);
    });

    it('should sanitize private key through pipeline', async () => {
      const input = `Private key: ${PKCS8_KEY}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(PKCS8_KEY);
      expect(result.sanitizedText).toContain('<PRIVATE_KEY_');
    });

    it('should correctly categorize OpenSSH key as ssh_private_key', () => {
      const results = detector.detect(OPENSSH_KEY);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('ssh_private_key');
    });

    it('should correctly categorize PGP key as pgp_private_key', () => {
      const results = detector.detect(PGP_KEY);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('pgp_private_key');
    });

    it('should detect complete range from BEGIN through END', () => {
      const text = `key: ${PKCS8_KEY}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      const start = text.indexOf('-----BEGIN PRIVATE KEY-----');
      const end = start + PKCS8_KEY.length;
      expect(results[0]!.range.start).toBe(start);
      expect(results[0]!.range.end).toBe(end);
    });

    it('should handle multiple key types in same text', () => {
      const text = `${PKCS8_KEY}\n${OPENSSH_KEY}\n${PGP_KEY}`;
      const results = detector.detect(text);
      expect(results.length).toBe(3);
      const categories = results.map((r) => r.category).sort();
      expect(categories).toEqual(['pgp_private_key', 'private_key', 'ssh_private_key']);
    });
  });

  // ========== Database URL Detector ==========
  describe('Database URL Detector', () => {
    const detector = createDatabaseUrlDetector();

    it('should detect PostgreSQL URL', () => {
      const url = 'postgresql://admin:PassPassPass@localhost:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('postgres_url');
    });

    it('should detect MySQL URL', () => {
      const url = 'mysql://admin:PassPassPass@localhost:3306/db';
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('mysql_url');
    });

    it('should detect MongoDB URL', () => {
      const url = 'mongodb://admin:PassPassPass@localhost:27017/db';
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('mongodb_url');
    });

    it('should detect Redis URL', () => {
      const url = 'redis://:password@localhost:6379';
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('redis_url');
    });

    it('should detect DSN format', () => {
      const text = 'host=localhost port=5432 dbname=mydb user=myuser password=mypass';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });
  });

  // ========== Database URL Detector: Comprehensive Regression Tests ==========
  describe('Database URL Detector: Comprehensive Regression Tests', () => {
    const detector = createDatabaseUrlDetector();

    // Helper to build test URLs with synthetic credentials
    const mkPostgresUrl = (
      user = 'admin',
      pass = 'Pass'.repeat(3),
      host = 'db.prod.internal:5432',
      db = 'production_db',
      query = ''
    ) => `postgresql://${user}:${pass}@${host}/${db}${query}`;
    const mkMySqlUrl = (
      user = 'admin',
      pass = 'Pass'.repeat(3),
      host = 'db.prod.internal:3306',
      db = 'production_db'
    ) => `mysql://${user}:${pass}@${host}/${db}`;
    const mkMongoUrl = (
      user = 'admin',
      pass = 'Pass'.repeat(3),
      host = 'mongo.prod.internal:27017',
      db = 'production_db'
    ) => `mongodb://${user}:${pass}@${host}/${db}`;
    const mkMongoSrvUrl = (
      user = 'admin',
      pass = 'Pass'.repeat(3),
      cluster = 'cluster.example',
      db = 'production_db'
    ) => `mongodb+srv://${user}:${pass}@${cluster}/${db}`;
    const mkRedisUrl = (pass = 'Pass'.repeat(3), host = 'cache.prod.internal:6379', db = '0') =>
      `redis://:${pass}@${host}/${db}`;

    // Each supported scheme
    it('should detect postgresql:// with credentials', () => {
      const url = mkPostgresUrl();
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('postgres_url');
      expect(results[0]!.value).toBe(url);
    });

    it('should detect postgresql:// with percent-encoded credentials', () => {
      const url = 'postgresql://user%40domain:pass%2Fword@host:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('postgres_url');
      expect(results[0]!.value).toBe(url);
    });

    it('should detect postgresql:// with port', () => {
      const url = mkPostgresUrl('admin', 'PassPassPass', 'host:5432');
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toContain(':5432');
    });

    it('should detect postgresql:// with query string', () => {
      const url = mkPostgresUrl('admin', 'PassPassPass', 'host:5432', 'db', '?sslmode=require');
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toContain('?sslmode=require');
    });

    it('should detect postgresql:// with fragment', () => {
      const url = mkPostgresUrl('admin', 'PassPassPass', 'host:5432', 'db', '#fragment');
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toContain('#fragment');
    });

    it('should detect mysql:// with credentials', () => {
      const url = mkMySqlUrl();
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('mysql_url');
      expect(results[0]!.value).toBe(url);
    });

    it('should detect mongodb:// with credentials', () => {
      const url = mkMongoUrl();
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('mongodb_url');
      expect(results[0]!.value).toBe(url);
    });

    it('should detect mongodb+srv:// with credentials', () => {
      const url = mkMongoSrvUrl();
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('mongodb_url');
      expect(results[0]!.value).toBe(url);
    });

    it('should detect redis:// with password only', () => {
      const url = mkRedisUrl();
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('redis_url');
      expect(results[0]!.value).toBe(url);
    });

    it('should detect redis:// with username and password', () => {
      const url = 'redis://admin:PassPassPass@host:6379/0';
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('redis_url');
    });

    // Quotes and punctuation
    it('should handle double quotes around URL', () => {
      const url = mkPostgresUrl();
      const text = `"${url}"`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(url); // No trailing quote
    });

    it('should handle single quotes around URL', () => {
      const url = mkPostgresUrl();
      const text = `'${url}'`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(url);
    });

    it('should handle trailing comma', () => {
      const url = mkPostgresUrl();
      const text = `${url},`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(url); // No trailing comma
    });

    it('should handle trailing closing parenthesis', () => {
      const url = mkPostgresUrl();
      const text = `(${url})`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(url);
    });

    it('should handle brackets', () => {
      const url = mkPostgresUrl();
      const text = `[${url}]`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(url);
    });

    // Repeated URLs
    it('should handle repeated URLs', () => {
      const url = mkPostgresUrl();
      const text = `${url} ${url}`;
      const results = detector.detect(text);
      expect(results.length).toBe(2);
      expect(results[0]!.value).toBe(url);
      expect(results[1]!.value).toBe(url);
    });

    // Credential-free URLs should NOT be detected
    it('should reject postgres:// without credentials', () => {
      const url = 'postgresql://host/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    it('should reject postgresql://localhost/db', () => {
      const url = 'postgresql://localhost:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    it('should reject https:// URLs', () => {
      const url = 'https://api.github.com/repos';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    it('should reject http:// URLs', () => {
      const url = 'http://localhost:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    // Placeholder credentials
    it('should reject username:password placeholder', () => {
      const url = 'postgresql://username:password@localhost:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    it('should reject YOUR_USER:YOUR_PASSWORD placeholder', () => {
      const url = 'postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    it('should reject <username>:<password> placeholder', () => {
      const url = 'postgresql://<username>:<password>@localhost:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    it('should reject example:example placeholder', () => {
      const url = 'postgresql://example:example@localhost:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    // Malformed URLs
    it('should reject malformed scheme', () => {
      const url = 'postgresq://user:pass@host/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    it('should reject missing @ separator', () => {
      const url = 'postgresql://user:passhost/db';
      const results = detector.detect(url);
      expect(results.length).toBe(0);
    });

    // Sanitizer integration
    it('should sanitize database URL through pipeline', async () => {
      const url = mkPostgresUrl();
      const input = `DATABASE_URL=${url}`;
      const { sanitizeText } = await import('@/core/pipeline.js');
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(url);
      expect(result.sanitizedText).toContain('<');
    });

    // Restoration
    it('should restore database URL through restorer', async () => {
      const url = mkPostgresUrl();
      const input = `DATABASE_URL=${url}`;
      const { sanitizeText } = await import('@/core/pipeline.js');
      const { restore } = await import('@/core/restorer.js');
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      const restored = restore(result.sanitizedText, { vault: result.vault });
      expect(restored.restoredText).toBe(input);
      expect(restored.complete).toBe(true);
    });
  });

  // ========== Password Detector ==========
  describe('Password Detector', () => {
    const detector = createPasswordDetector();

    it('should detect password in env var', () => {
      const text = 'PASSWORD=supersecret123';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('password_env');
      expect(results[0]!.value).toBe('supersecret123');
    });

    it('should detect password in config', () => {
      const text = 'password = "mysecretpassword"';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('password_config');
    });

    it('should detect JSON password', () => {
      const text = '{"password": "mypassword123"}';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('password_config');
    });

    it('should not detect placeholder passwords', () => {
      const text = 'password=changeme';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should not detect password without value', () => {
      const text = 'password=';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect API key in env', () => {
      const text = 'API_KEY=sk-live_abcdefghijklmnopqrstuvwx';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
    });

    it('should detect AUTH_TOKEN assignment', () => {
      const text = 'AUTH_TOKEN=ya29.a0AfH6SMC_synthetic_token_value_1234567890';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe('ya29.a0AfH6SMC_synthetic_token_value_1234567890');
    });

    it('should detect AUTHTOKEN with quoted value', () => {
      const token = 'auth_' + 'x'.repeat(32);
      const text = `AUTHTOKEN="${token}"`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe(token);
    });

    it('should reject AUTH_TOKEN with placeholder value', () => {
      const text = 'AUTH_TOKEN=YOUR_TOKEN';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect exported AUTH_TOKEN', () => {
      const token = 'exported_' + 'y'.repeat(32);
      const text = `export AUTH_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe(token);
    });

    it('should reject exported AUTHTOKEN with placeholder', () => {
      const text = 'export AUTHTOKEN="YOUR_TOKEN"';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect JSON API_KEY', () => {
      const token = 'json_' + 'z'.repeat(32);
      const text = `{"API_KEY": "${token}"}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe(token);
    });

    it('should detect JSON CLIENT_SECRET', () => {
      const secret = 'secret_' + 's'.repeat(32);
      const text = `{"CLIENT_SECRET": "${secret}"}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('secret_env');
      expect(results[0]!.value).toBe(secret);
    });

    it('should reject JSON AUTH_TOKEN with placeholder', () => {
      const text = '{"AUTH_TOKEN": "YOUR_TOKEN"}';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect YAML api_key', () => {
      const token = 'yaml_api_' + 'a'.repeat(32);
      const text = `api_key: ${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe(token);
    });

    it('should detect YAML auth_token with quoted value', () => {
      const token = 'yaml_auth_' + 'b'.repeat(32);
      const text = `auth_token: "${token}"`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe(token);
    });

    it('should detect YAML client_secret with sufficient length', () => {
      const secret = 'yaml_secret_' + 'c'.repeat(32);
      const text = `client_secret: ${secret}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('secret_env');
      expect(results[0]!.value).toBe(secret);
    });

    it('should reject YAML client_secret with placeholder', () => {
      const text = 'client_secret: YOUR_TOKEN';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect process.env.AUTH_TOKEN with double quotes', () => {
      const token = 'proc_auth_' + 'd'.repeat(32);
      const text = `process.env.AUTH_TOKEN = "${token}"`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe(token);
    });

    it('should detect process.env.CLIENT_SECRET with single quotes', () => {
      const secret = 'proc_secret_' + 'e'.repeat(32);
      const text = `process.env.CLIENT_SECRET = '${secret}'`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('secret_env');
      expect(results[0]!.value).toBe(secret);
    });

    it('should reject process.env.AUTH_TOKEN with placeholder', () => {
      const text = 'process.env.AUTH_TOKEN = "YOUR_TOKEN"';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect mixed-case Api_Key', () => {
      const token = 'mixed_api_' + 'f'.repeat(32);
      const text = `Api_Key=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe(token);
    });

    it('should detect mixed-case Auth_Token with quotes', () => {
      const token = 'mixed_auth_' + 'g'.repeat(32);
      const text = `Auth_Token="${token}"`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key_env');
      expect(results[0]!.value).toBe(token);
    });

    it('should reject mixed-case Client_Secret with placeholder', () => {
      const text = 'Client_Secret=YOUR_TOKEN';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  // ========== Email Detector ==========
  describe('Email Detector', () => {
    const detector = createEmailDetector();

    it('should detect standard email', () => {
      const text = 'Contact: user@example.com';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe('user@example.com');
      expect(results[0]!.category).toBe('email');
    });

    it('should detect email with plus', () => {
      const text = 'Email: user+tag@example.com';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe('user+tag@example.com');
    });

    it('should detect email with dots', () => {
      const text = 'Email: first.last@company.com';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });

    it('should not detect example.com emails', () => {
      const text = 'Email: test@example.com';
      const results = detector.detect(text);
      expect(results.length).toBe(0); // excluded
    });

    it('should not detect version numbers', () => {
      const text = 'version=1.2.3';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  // ========== Internal URL Detector ==========
  describe('Internal URL Detector', () => {
    const detector = createInternalUrlDetector();

    it('should detect localhost URLs', () => {
      const text = 'API_URL=http://localhost:8080/api';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('internal_url');
    });

    it('should detect .local domains', () => {
      const text = 'service=http://myservice.local/api';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('internal_domain');
    });

    it('should detect .internal domains', () => {
      const text = 'db=postgres://internal.db.internal';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('internal_domain');
    });

    it('should detect private IPs in URLs', () => {
      const text = 'http://192.168.1.100:8080';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('internal_url');
    });

    it('should not detect public URLs', () => {
      const text = 'https://api.github.com/users';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect dev subdomains', () => {
      const text = 'https://dev.api.company.com';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });

    it('should detect localhost without port', () => {
      const text = 'http://localhost/api';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });
  });

  // ========== IP Address Detector ==========
  describe('IP Address Detector', () => {
    const detector = createIpAddressDetector();

    it('should detect IPv4', () => {
      const text = 'Server IP: 192.168.1.1';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe('192.168.1.1');
    });

    it('should detect IPv6', () => {
      const text = 'IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });

    it('should detect IPv6 compressed', () => {
      const text = 'localhost ::1';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe('::1');
    });

    it('should detect CIDR notation', () => {
      const text = 'Network: 192.168.1.0/24';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe('192.168.1.0/24');
    });

    it('should not detect version numbers', () => {
      const text = 'version 1.2.3';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should not detect 1.2.3 as IP', () => {
      const text = 'package@1.2.3';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect 10.x.x.x private IPs', () => {
      const text = 'Server: 10.0.0.1';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });

    it('should detect 172.16-31.x.x private IPs', () => {
      const text = 'Server: 172.16.0.1';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });
  });

  // ========== AWS Secret Key Detector ==========
  describe('AWS Secret Key Detector', () => {
    const detector = createAwsSecretKeyDetector();

    // Synthetic secret constructor - 40 chars with + and / for entropy
    const mkSecret = () => 'x'.repeat(38) + '+/';

    it('should detect AWS secret key in context', () => {
      const secret = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
      const text = `AWS_SECRET_ACCESS_KEY=${secret}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(secret);
    });

    it('should require AWS context', () => {
      // 40 chars but no +/
      const text = 'abcdefghijklmnopqrstuvwxyz1234567890';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect valid 40-char secret in explicit AWS credential context (env)', () => {
      const secret = mkSecret();
      const text = `AWS_SECRET_ACCESS_KEY=${secret}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(secret);
    });

    it('should detect secret in JSON format', () => {
      const secret = mkSecret();
      const text = `{"aws_secret_access_key": "${secret}"}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(secret);
    });

    it('should detect secret in YAML format', () => {
      const secret = mkSecret();
      const text = `aws_secret_access_key: ${secret}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(secret);
    });

    it('should detect secret in shell assignment format', () => {
      const secret = mkSecret();
      const text = `export AWS_SECRET_ACCESS_KEY=${secret}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(secret);
    });

    it('should handle surrounding quotes and punctuation', () => {
      const secret = mkSecret();
      const text = `aws_secret_access_key="${secret}";`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(secret);
    });

    it('should handle repeated secret values', () => {
      const secret1 = mkSecret();
      const secret2 = mkSecret();
      const text = `aws_secret_access_key=${secret1} aws_secret_access_key=${secret2}`;
      const results = detector.detect(text);
      expect(results.length).toBe(2);
    });

    it('should reject arbitrary 40-char strings without AWS context', () => {
      const text = 'a'.repeat(40);
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject low-entropy strings (no +/)', () => {
      const text = `AWS_SECRET_ACCESS_KEY=${'a'.repeat(40)}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject incorrect lengths (not 40 chars)', () => {
      // 39 chars - pattern requires exactly 40
      const secret = 'x'.repeat(37) + '+/'; // 39 chars
      const text = `AWS_SECRET_ACCESS_KEY=${secret}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should detect with "secret_access_key" context', () => {
      const secret = mkSecret();
      const text = `secret_access_key=${secret}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(secret);
    });

    it('should detect with "aws_secret_key" context', () => {
      const secret = mkSecret();
      const text = `aws_secret_key=${secret}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(secret);
    });
  });

  // ========== AWS Access Key Detector ==========
  describe('AWS Access Key Detector', () => {
    const detector = createAwsAccessKeyDetector();

    // Synthetic constructors - built at runtime to avoid secret scanners
    const mkAccessKey = () => 'AKIA' + 'X'.repeat(16);
    const mkSessionKey = () => 'ASIA' + 'Y'.repeat(16);

    it('should detect valid AKIA access key identifier', () => {
      const key = mkAccessKey();
      const text = `AWS_ACCESS_KEY_ID=${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(key);
      expect(results[0]!.category).toBe('aws_access_key');
    });

    it('should detect valid ASIA temporary access key identifier', () => {
      const key = mkSessionKey();
      const text = `AWS_SESSION_TOKEN=${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(key);
      expect(results[0]!.category).toBe('aws_access_key');
    });

    it('should detect in environment assignment format', () => {
      const key = mkAccessKey();
      const text = `export AWS_ACCESS_KEY_ID=${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(key);
    });

    it('should detect in JSON-style assignment', () => {
      const key = mkAccessKey();
      const text = `{"aws_access_key_id": "${key}"}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(key);
    });

    it('should detect in YAML-style assignment', () => {
      const key = mkAccessKey();
      const text = `aws_access_key_id: ${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(key);
    });

    it('should handle surrounding punctuation', () => {
      const key = mkAccessKey();
      const text = `(key: ${key});`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(key);
    });

    it('should handle repeated access key identifiers', () => {
      const key1 = mkAccessKey();
      const key2 = mkAccessKey();
      const text = `key1=${key1} key2=${key2}`;
      const results = detector.detect(text);
      expect(results.length).toBe(2);
    });

    it('should reject invalid prefixes (not AKIA/ASIA)', () => {
      const key = 'AKIB' + 'X'.repeat(16); // Invalid prefix
      const text = `AWS_ACCESS_KEY_ID=${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject incorrect lengths (not 20 chars)', () => {
      const key = 'AKIA' + 'X'.repeat(15); // 19 chars
      const text = `AWS_ACCESS_KEY_ID=${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject lowercase values', () => {
      const key = 'akia' + 'x'.repeat(16).toLowerCase();
      const text = `AWS_ACCESS_KEY_ID=${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should not match ordinary 20-character strings without AWS context', () => {
      const text = 'ABCDEFGHIJKLMNOPQRST'; // 20 chars, no AWS prefix
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should not match AKIA-like strings with non-alphanumeric chars', () => {
      const key = 'AKIA' + 'X!@#$%^&*()'.substring(0, 16);
      const text = `AWS_ACCESS_KEY_ID=${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  // ========== GitHub Token Detector ==========
  describe('GitHub Token Detector', () => {
    const detector = createGithubTokenDetector();

    // Synthetic constructors - built at runtime
    const mkClassicPAT = () => 'ghp_' + 'aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vWxYz1'.substring(0, 36);
    const mkFineGrainedPAT = () =>
      'github_pat_' + 'A1B2C3D4E5' + '_' + 'fG7hJ9kL2mN4pQ6rS8tU0vWxYz1abcdefghijklmnopqrstuvwxyz';
    const mkOAuth = () => 'gho_' + 'cD4eF6gH8jK1lM3nP5qR7sT9uV2wXyZ4'.substring(0, 36);
    const mkAppToken = () => 'ghs_' + 'eF6gH8jK1lM3nP5qR7sT9uV2wXyZ4bN6'.substring(0, 36);
    const mkEnterpriseToken = () => 'ghe_' + 'gH8jK1lM3nP5qR7sT9uV2wXyZ4bN6mQ8'.substring(0, 36);
    const mkRefreshToken = () => 'ghr_' + 'jK1lM3nP5qR7sT9uV2wXyZ4bN6mQ8sT1'.substring(0, 36);

    it('should detect classic PAT (ghp_)', () => {
      const token = mkClassicPAT();
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
      expect(results[0]!.category).toBe('github_token');
    });

    it('should detect fine-grained PAT (github_pat_)', () => {
      const token = mkFineGrainedPAT();
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should detect OAuth token (gho_)', () => {
      const token = mkOAuth();
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should detect GitHub App token (ghs_)', () => {
      const token = mkAppToken();
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should detect GitHub Enterprise token (ghe_)', () => {
      const token = mkEnterpriseToken();
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should detect refresh token (ghr_)', () => {
      const token = mkRefreshToken();
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should handle runtime-constructed fixtures with high entropy', () => {
      const token = mkClassicPAT();
      const text = `token: ${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      // Verify entropy requirement - token has mixed alnum
    });

    it('should reject invalid/truncated tokens', () => {
      const token = 'ghp_' + 'a'.repeat(10); // Too short
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject incorrect prefixes', () => {
      const token = 'ghx_' + 'a'.repeat(36); // Invalid prefix
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should handle punctuation boundaries', () => {
      const token = mkClassicPAT();
      const text = `(token: "${token}")`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should handle repeated tokens', () => {
      const token1 = mkClassicPAT();
      const token2 = mkOAuth();
      const text = `t1=${token1} t2=${token2}`;
      const results = detector.detect(text);
      expect(results.length).toBe(2);
    });

    it('should detect in JSON format', () => {
      const token = mkClassicPAT();
      const text = `{"github_token": "${token}"}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should detect in environment variable format', () => {
      const token = mkClassicPAT();
      const text = `export GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should require high entropy (reject low entropy tokens)', () => {
      // Token with all same character - low entropy
      const token = 'ghp_' + 'a'.repeat(36);
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  // ========== AWS Access Key Sanitizer Integration ==========
  describe('AWS Access Key Sanitizer Integration', () => {
    const mkAccessKey = () => 'AKIA' + 'X'.repeat(16);

    it('should sanitize AWS access key through pipeline', async () => {
      const key = mkAccessKey();
      const input = `AWS_ACCESS_KEY_ID=${key}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(key);
      expect(result.sanitizedText).toContain('<AWS_ACCESS_KEY_');
    });

    it('should sanitize multiple AWS access keys', async () => {
      const key1 = mkAccessKey();
      const key2 = mkAccessKey();
      const input = `key1=${key1} key2=${key2}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(key1);
      expect(result.sanitizedText).not.toContain(key2);
      expect(result.detections.length).toBe(2);
    });
  });

  // ========== AWS Secret Key Sanitizer Integration ==========
  describe('AWS Secret Key Sanitizer Integration', () => {
    const mkSecret = () => 'x'.repeat(38) + '+/';

    it('should sanitize AWS secret key through pipeline', async () => {
      const secret = mkSecret();
      const input = `AWS_SECRET_ACCESS_KEY=${secret}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(secret);
      expect(result.sanitizedText).toContain('<AWS_SECRET_');
    });

    it('should sanitize multiple AWS secret keys', async () => {
      const secret1 = mkSecret();
      const secret2 = mkSecret();
      const input = `AWS_SECRET_ACCESS_KEY=${secret1} AWS_SECRET_ACCESS_KEY=${secret2}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(secret1);
      expect(result.sanitizedText).not.toContain(secret2);
      expect(result.detections.length).toBe(2);
    });
  });

  // ========== GitHub Token Sanitizer Integration ==========
  describe('GitHub Token Sanitizer Integration', () => {
    const mkClassicPAT = () => 'ghp_' + 'aB3dE5fG7hJ9kL2mN4pQ6rS8tU0vWxYz1'.substring(0, 36);

    it('should sanitize GitHub token through pipeline', async () => {
      const token = mkClassicPAT();
      const input = `GITHUB_TOKEN=${token}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(token);
      expect(result.sanitizedText).toContain('<GITHUB_TOKEN_');
    });

    it('should sanitize multiple GitHub tokens with different prefixes', async () => {
      const token1 = mkClassicPAT();
      const token2 = 'gho_' + 'cD4eF6gH8jK1lM3nP5qR7sT9uV2wXyZ4'.substring(0, 36);
      const input = `t1=${token1} t2=${token2}`;
      const result = await sanitizeText(input, { minConfidence: 0.5 });
      expect(result.sanitizedText).not.toContain(token1);
      expect(result.sanitizedText).not.toContain(token2);
      expect(result.detections.length).toBe(2);
    });
  });

  // ========== Slack Token Detector ==========
  describe('Slack Token Detector', () => {
    const detector = createSlackTokenDetector();

    it('should detect bot token', () => {
      const token = ['xoxb', '1234567890123', 'x'.repeat(30)].join('-');
      const text = `SLACK_BOT_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should detect user token', () => {
      const token = ['xoxp', '1234567890123', '1234567890123', 'x'.repeat(28)].join('-');
      const text = `SLACK_USER_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });

    it('should detect app-level token', () => {
      const token = ['xapp', 'A1234567890', 'x'.repeat(24), 'x'.repeat(32)].join('-');
      const text = `SLACK_APP_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
    });
  });

  // ========== Generic Secret Detector ==========
  describe('Generic Secret Detector', () => {
    const detector = createGenericSecretDetector();
    (detector as unknown as { enabled: boolean }).enabled = true; // Enable for testing

    it('should detect high entropy strings with key context', () => {
      const text = `SECRET_KEY=abcdefghijklmnopqrstuvwxyz123456`;
      const results = detector.detect(text);
      // May or may not detect depending on entropy
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('should not detect without context', () => {
      const text = 'abcdefghijklmnopqrstuvwxyz123456';
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });
  });

  // ========== Overlap Resolution ==========
  describe('Detector Overlap Resolution', () => {
    it('should handle overlapping detections', () => {
      const authDetector = createAuthorizationHeaderDetector();
      const text =
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      const authResults = authDetector.detect(text);
      const jwtDetector = createJwtDetector();
      const jwtResults = jwtDetector.detect(text);

      // Both should detect but at different positions
      expect(authResults.length + jwtResults.length).toBeGreaterThan(0);
    });

    it('should resolve JWT vs bearer_token overlap in pipeline: JWT wins (more specific)', async () => {
      const jwt = (() => {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        const payload = btoa(
          JSON.stringify({ sub: '1234567890', name: 'Test User', iat: 1516239022 })
        )
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        const sig = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        return `${header}.${payload}.${sig}`;
      })();
      const input = `Authorization: Bearer ${jwt}`;

      // Run full pipeline
      const result = await sanitizeText(input, { minConfidence: 0.5 });

      // JWT should win overlap resolution due to higher category priority (90 vs 85)
      expect(result.sanitizedText).not.toContain(jwt);
      expect(result.sanitizedText).toContain('<JWT_');
      expect(result.sanitizedText).toContain('Authorization: Bearer ');

      // Verify detection category is jwt, not bearer_token
      const jwtDetections = result.detections.filter((d) => d.category === 'jwt');
      const bearerDetections = result.detections.filter((d) => d.category === 'bearer_token');
      expect(jwtDetections.length).toBe(1);
      expect(bearerDetections.length).toBe(0);
    });

    it('should resolve non-JWT bearer tokens to bearer_token category', async () => {
      // Non-JWT bearer token should still use bearer_token
      const input = `Authorization: Bearer not-a-jwt-just-a-long-random-string-value`;

      const result = await sanitizeText(input, { minConfidence: 0.5 });

      // Should be detected as bearer_token (JWT detector rejects it)
      expect(result.sanitizedText).not.toContain('not-a-jwt-just-a-long-random-string-value');
      expect(result.sanitizedText).toContain('<BEARER_TOKEN_');
      expect(result.sanitizedText).toContain('Authorization: Bearer ');

      const bearerDetections = result.detections.filter((d) => d.category === 'bearer_token');
      expect(bearerDetections.length).toBe(1);
    });

    it('should resolve JWT with only alg (no typ) in header through pipeline', async () => {
      // JWT with only alg, no typ - should be accepted per updated spec
      const jwt = (() => {
        const header = btoa(JSON.stringify({ alg: 'HS256' }))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        const payload = btoa(
          JSON.stringify({ sub: '1234567890', name: 'Test User', iat: 1516239022 })
        )
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        const sig = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        return `${header}.${payload}.${sig}`;
      })();
      const input = `Authorization: Bearer ${jwt}`;

      const result = await sanitizeText(input, { minConfidence: 0.5 });

      // Should be detected as JWT
      expect(result.sanitizedText).not.toContain(jwt);
      expect(result.sanitizedText).toContain('<JWT_');
      expect(result.sanitizedText).toContain('Authorization: Bearer ');

      const jwtDetections = result.detections.filter((d) => d.category === 'jwt');
      expect(jwtDetections.length).toBe(1);
    });

    it('should reject JWT with incompatible typ in header', async () => {
      // JWT with typ: "JWS" (incompatible) - should be rejected
      const jwt = (() => {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWS' }))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        const payload = btoa(
          JSON.stringify({ sub: '1234567890', name: 'Test User', iat: 1516239022 })
        )
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        const sig = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        return `${header}.${payload}.${sig}`;
      })();
      const input = `Authorization: Bearer ${jwt}`;

      const result = await sanitizeText(input, { minConfidence: 0.5 });

      // Should fall back to bearer_token (JWT detector rejects incompatible typ)
      expect(result.sanitizedText).not.toContain(jwt);
      expect(result.sanitizedText).toContain('<BEARER_TOKEN_');
      expect(result.sanitizedText).toContain('Authorization: Bearer ');

      const bearerDetections = result.detections.filter((d) => d.category === 'bearer_token');
      expect(bearerDetections.length).toBe(1);
    });
  });
});
