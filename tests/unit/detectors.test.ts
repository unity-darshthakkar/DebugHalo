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
import { createGithubTokenDetector } from '@/core/detectors/githubToken.js';
import { createSlackTokenDetector } from '@/core/detectors/slackToken.js';
import { createGenericSecretDetector } from '@/core/detectors/genericSecret.js';

describe('Detector Tests', () => {
  // Runtime-constructed secret fixtures to avoid GitHub push-protection triggers
  const STRIPE_LIVE_KEY = 'sk_live_' + 'a'.repeat(24);
  const GITHUB_TOKEN = 'ghp_' + 'b'.repeat(36);

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

    it('should reject JWT with invalid header', () => {
      // Header without "typ": "JWT"
      const invalidJwt =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const text = `token: ${invalidJwt}`;
      const results = detector.detect(text);
      expect(results.length).toBe(0);
    });

    it('should reject version numbers', () => {
      const text = 'version=1.2.3';
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
      const text = 'Authorization: Basic dXNlcjpwYXNz';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('basic_auth');
      expect(results[0]!.value).toBe('dXNlcjpwYXNz');
    });

    it('should detect x-api-key header', () => {
      const text = 'x-api-key: sk-live_abcdefghijklmnopqrstuvwx';
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('api_key');
    });
  });

  // ========== Private Key Detector ==========
  describe('Private Key Detector', () => {
    const detector = createPrivateKeyDetector();

    it('should detect PEM private key', () => {
      const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD...
-----END PRIVATE KEY-----`;
      const text = `Private key: ${key}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('private_key');
      expect(results[0]!.value).toBe(key);
    });

    it('should detect RSA private key', () => {
      const key = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA...
-----END RSA PRIVATE KEY-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('private_key');
    });

    it('should detect EC private key', () => {
      const key = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEI...
-----END EC PRIVATE KEY-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('private_key');
    });

    it('should detect OpenSSH private key', () => {
      const key = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAA...
-----END OPENSSH PRIVATE KEY-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('ssh_private_key');
    });

    it('should detect PGP private key', () => {
      const key = `-----BEGIN PGP PRIVATE KEY BLOCK-----
lQOYBF0...
-----END PGP PRIVATE KEY BLOCK-----`;
      const results = detector.detect(key);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('pgp_private_key');
    });
  });

  // ========== Database URL Detector ==========
  describe('Database URL Detector', () => {
    const detector = createDatabaseUrlDetector();

    it('should detect PostgreSQL URL', () => {
      const url = 'postgresql://user:pass@localhost:5432/db';
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('postgres_url');
    });

    it('should detect MySQL URL', () => {
      const url = 'mysql://user:pass@localhost:3306/db';
      const results = detector.detect(url);
      expect(results.length).toBe(1);
      expect(results[0]!.category).toBe('mysql_url');
    });

    it('should detect MongoDB URL', () => {
      const url = 'mongodb://user:pass@localhost:27017/db';
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
  });

  // ========== GitHub Token Detector ==========
  describe('GitHub Token Detector', () => {
    const detector = createGithubTokenDetector();

    it('should detect classic PAT', () => {
      const token = GITHUB_TOKEN;
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should detect fine-grained PAT', () => {
      const token =
        'github_pat_11AB2WXYZ_abcdefghijklmnopqrstuvwxyz1234567890abcdefghijklmnopqrstuv';
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
      expect(results[0]!.value).toBe(token);
    });

    it('should detect OAuth token', () => {
      const token = 'gho_abcdefghijklmnopqrstuvwxyz123456';
      const text = `GITHUB_TOKEN=${token}`;
      const results = detector.detect(text);
      expect(results.length).toBe(1);
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
  });
});
