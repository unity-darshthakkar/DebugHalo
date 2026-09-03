# Security Policy

## 🔒 Security is Our Priority

DebugHalo is designed with security and privacy as core principles. As a local-first tool that processes potentially sensitive data, we take security very seriously.

## 🐛 Reporting a Vulnerability

If you discover a security vulnerability in DebugHalo, please report it responsibly:

**Do NOT** create a public issue for security vulnerabilities.

Instead, contact the repository owner privately through GitHub and ask for a secure channel. Do not include vulnerability details in a public issue.

Include as much information as possible:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any proof-of-concept code or screenshots

## 🛡️ Security Practices

### Local-First Processing

- All data processing occurs locally on the user's machine
- No data is transmitted to external servers without explicit user consent
- No telemetry or data collection by default

### Dependency Management

- We use npm audit to check for known vulnerabilities in dependencies
- Dependencies are kept up-to-date regularly
- We carefully vet new dependencies before adding them

### Code Security

- All code is reviewed through pull requests
- We follow the principle of least privilege
- Input validation and sanitization are priorities
- We avoid using `eval()` and similar dangerous functions

## 🔐 Handling Sensitive Data in Development

When contributing to DebugHalo:

1. **Never commit real secrets, passwords, or private keys** to the repository
2. Use mock data or environment variables for testing
3. If you accidentally commit sensitive data, notify the maintainers immediately
4. Our `.gitignore` is designed to prevent accidental commits of sensitive files

## 📦 Dependencies

We monitor our dependencies for security vulnerabilities using:

- npm audit (run regularly)
- Dependabot alerts (if enabled)
- Regular updates to patch known vulnerabilities

## 🏷️ Security Updates

Security patches will be released as needed and announced through:

- GitHub Security Advisories
- Release notes
- Project documentation

## 🙏 Acknowledgments

We thank all security researchers who help keep DebugHalo safe and secure. Responsible disclosure makes our project stronger for everyone.

## 📞 Contact

For security-related inquiries, contact the repository owner privately through GitHub. For general questions or non-security issues, use the [GitHub Issues](https://github.com/unity-darshthakkar/DebugHalo/issues) page.
