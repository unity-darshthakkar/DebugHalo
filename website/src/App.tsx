import { useEffect, useRef, useState, type ReactNode } from 'react';
import { release } from './release.js';

const TEST_SECRET = 'AKIAIOSFODNN7EXAMPLE';
const INITIAL_MESSAGE = `AWS_ACCESS_KEY_ID=${TEST_SECRET}`;
const SANITIZED_MESSAGE = 'AWS_ACCESS_KEY_ID=<AWS_ACCESS_KEY_1>';

const features = [
  ['Local pre-send scan', 'Inspect outgoing composer text before it leaves your browser.'],
  ['Review findings', 'See category, severity, and confidence without repeating the raw secret.'],
  ['Sanitize locally', 'Replace detected values with clear aliases and preview every change.'],
  ['Choose your response', 'Ask each time, open a sanitized preview, or block sensitive sends.'],
  ['Stay in control', 'Cancel, explicitly Send Anyway, or turn protection off when needed.'],
  ['See this session', 'Track scans, blocks, sanitizations, and Send Anyway approvals safely.'],
] as const;

const installSteps = [
  ['Download', 'Get the latest versioned ZIP from the official GitHub release.'],
  ['Extract', 'Unzip the archive into a stable folder on your computer.'],
  ['Open extensions', 'Navigate to chrome://extensions in Chrome or Chromium.'],
  ['Developer mode', 'Enable the Developer mode toggle in the top-right corner.'],
  ['Load unpacked', 'Choose Load unpacked and select the extracted DebugHalo folder.'],
  ['Pin it', 'Pin DebugHalo from the extensions menu for quick settings access.'],
] as const;

const workflow = [
  'Write / Paste',
  'Scan locally',
  'Detect',
  'Review / Sanitize',
  'Confirm',
  'Send',
];

const trustItems = [
  'Local scanning',
  'Open source',
  'No message telemetry',
  'MIT licensed',
] as const;

const proofItems = [
  ['600+', 'automated tests'],
  ['3', 'supported AI platforms'],
  ['0', 'production dependency vulnerabilities'],
  ['MIT', 'open-source license'],
] as const;

const reasons = [
  [
    'Local-first by design',
    'Composer text is inspected in your browser—not by a DebugHalo cloud service.',
  ],
  ['Transparent', 'The implementation is open source, inspectable, and backed by automated tests.'],
  ['User-controlled', 'Review, sanitize, block, or explicitly approve a sensitive submission.'],
  [
    'Built for AI workflows',
    'Focused protection for text sent through ChatGPT, Claude, and Gemini.',
  ],
] as const;

const caughtExamples = [
  ['API keys', 'AKIA…EXAMPLE'],
  ['Bearer tokens', 'Bearer <TOKEN>'],
  ['Database URLs', 'postgres://user:<PASSWORD>@host'],
  ['Email addresses', '<EMAIL_1>'],
  ['Internal URLs', 'https://<INTERNAL_HOST>/api'],
  ['Service credentials', 'client_secret=<SECRET>'],
] as const;

export function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <TrustStrip />
        <Demo />
        <DemoCta />
        <Workflow />
        <WhyDebugHalo />
        <Catches />
        <Features />
        <Supported />
        <Architecture />
        <Privacy />
        <ScopeLimits />
        <Install />
        <Cli />
        <Roadmap />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const links = [
    ['How it works', '#how-it-works'],
    ['Features', '#features'],
    ['Supported AI', '#supported'],
    ['Privacy', '#privacy'],
    ['Install', '#install'],
  ] as const;
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const sections = links
      .map(([, href]) => document.querySelector<HTMLElement>(href))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActive(`#${visible.target.id}`);
      },
      { rootMargin: '-25% 0px -65%', threshold: 0 }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  return (
    <header className="nav-shell">
      <nav className="nav wrap" aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="DebugHalo home">
          <Logo /> <span>DebugHalo</span>
        </a>
        <button
          className="menu-button"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="primary-links"
          onClick={() => setOpen(!open)}
        >
          <span /> <span />
        </button>
        <div className={`nav-links ${open ? 'open' : ''}`} id="primary-links">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              aria-current={active === href ? 'location' : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
          <ExternalLink href={release.repositoryUrl}>GitHub</ExternalLink>
          <DownloadButton className="button small" onClick={() => setOpen(false)} />
        </div>
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero wrap" id="top">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="pulse" /> Protection before transmission
        </div>
        <h1>
          Stop secrets before they reach <span>AI.</span>
        </h1>
        <p className="hero-lede">
          DebugHalo scans outgoing text locally and helps you review or sanitize sensitive
          information before it reaches ChatGPT, Claude, or Gemini.
        </p>
        <div className="hero-actions">
          <DownloadButton className="button" icon />
          <ExternalLink className="button secondary" href={release.repositoryUrl}>
            <GithubIcon /> View on GitHub
          </ExternalLink>
        </div>
        <p className="trust-line">
          <LockIcon /> Local-first. No message content sent to DebugHalo servers.
        </p>
      </div>
      <div className="hero-visual" aria-label="DebugHalo protection visualization">
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="shield-card">
          <Logo large />
          <div>
            <strong>Protection is on</strong>
            <span>Outgoing text guarded locally</span>
          </div>
          <span className="status-dot">Active</span>
        </div>
        <div className="signal-card signal-one">
          <span>AWS key</span>
          <strong>Blocked</strong>
        </div>
        <div className="signal-card signal-two">
          <span>Message data</span>
          <strong>Stayed local</strong>
        </div>
        <div className="grid-glow" />
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="trust-strip wrap" aria-label="Product trust signals">
      {trustItems.map((item) => (
        <div key={item}>
          <CheckIcon /> <span>{item}</span>
        </div>
      ))}
    </section>
  );
}

type DemoState = 'ready' | 'scanning' | 'blocked' | 'preview' | 'sent';

function Demo() {
  const [state, setState] = useState<DemoState>('ready');
  const [message, setMessage] = useState(INITIAL_MESSAGE);
  const [sentMessage, setSentMessage] = useState('');
  const timeoutRef = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const send = () => {
    if (!message.trim()) return;
    setState('scanning');
    timeoutRef.current = window.setTimeout(() => {
      if (message.includes(TEST_SECRET)) setState('blocked');
      else {
        setSentMessage(message);
        setState('sent');
      }
    }, 520);
  };
  const sanitize = () => {
    setMessage(SANITIZED_MESSAGE);
    setState('preview');
  };
  const confirm = () => {
    setSentMessage(SANITIZED_MESSAGE);
    setState('sent');
  };
  const reset = () => {
    window.clearTimeout(timeoutRef.current);
    setMessage(INITIAL_MESSAGE);
    setSentMessage('');
    setState('ready');
  };

  const stage = {
    ready: ['01', 'Sensitive text entered'],
    scanning: ['02', 'Local scan in progress'],
    blocked: ['03', 'Credential detected · submission blocked'],
    preview: ['04', 'Safe alias ready for confirmation'],
    sent: ['05', 'Sanitized message sent'],
  }[state];

  return (
    <Section
      id="demo"
      kicker="Try the flow"
      title="See the stop before the send"
      intro="A safe, deterministic simulation of the extension workflow. The credential below is a public test value."
    >
      <div className="demo-frame" data-testid="product-demo">
        <div className="demo-progress" aria-live="polite">
          <span>{stage[0]}</span>
          <strong>{stage[1]}</strong>
          <div aria-hidden="true">
            <i
              style={{
                width: `${(['ready', 'scanning', 'blocked', 'preview', 'sent'].indexOf(state) + 1) * 20}%`,
              }}
            />
          </div>
        </div>
        <div className="demo-topbar">
          <span />
          <span />
          <span />
          <p>Simulated AI conversation</p>
          <div className="demo-protected">
            <ShieldIcon /> DebugHalo on
          </div>
        </div>
        <div className="demo-body">
          <div className="conversation" aria-live="polite">
            <div className="ai-message">
              <span>AI</span>
              <p>How can I help with your configuration?</p>
            </div>
            {sentMessage && (
              <div className="user-message" data-testid="sent-message">
                <span>You</span>
                <p>{sentMessage}</p>
              </div>
            )}
            {state === 'sent' && (
              <div className="success-note">
                <CheckIcon /> Sanitized message sent. The raw test key stayed out.
              </div>
            )}
          </div>
          <div
            className={`composer ${state === 'blocked' || state === 'preview' ? 'intercepted' : ''}`}
          >
            <label htmlFor="demo-message">Outgoing message</label>
            <textarea
              id="demo-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setState('ready');
              }}
              rows={3}
              disabled={state === 'scanning' || state === 'sent'}
            />
            <div className="composer-footer">
              <span>
                <PaperclipIcon /> Attachments not scanned
              </span>
              <button
                className="send-button"
                type="button"
                onClick={send}
                disabled={state === 'scanning' || state === 'sent'}
              >
                {state === 'scanning' ? 'Scanning…' : 'Send'} <ArrowIcon />
              </button>
            </div>
          </div>
          {(state === 'blocked' || state === 'preview') && (
            <div className="review-card" data-testid="review-card" role="status">
              <div className="review-heading">
                <div className="warning-icon">!</div>
                <div>
                  <span>Submission paused</span>
                  <h3>Sensitive content detected</h3>
                </div>
                <b>HIGH</b>
              </div>
              {state === 'blocked' ? (
                <>
                  <div className="finding">
                    <div>
                      <strong>AWS Access Key</strong>
                      <span>Credential pattern · 99% confidence</span>
                    </div>
                    <ShieldIcon />
                  </div>
                  <p className="safe-note">The raw value is intentionally not repeated here.</p>
                  <div className="review-actions">
                    <button type="button" className="text-button" onClick={reset}>
                      Cancel
                    </button>
                    <button type="button" className="button compact" onClick={sanitize}>
                      Sanitize
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="preview-box">
                    <span>Sanitized preview</span>
                    <code>{SANITIZED_MESSAGE}</code>
                  </div>
                  <div className="review-actions">
                    <button type="button" className="text-button" onClick={reset}>
                      Back
                    </button>
                    <button type="button" className="button compact" onClick={confirm}>
                      Confirm sanitized send
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {state === 'sent' && (
            <button className="replay" type="button" onClick={reset}>
              <ReplayIcon /> Replay demo
            </button>
          )}
        </div>
      </div>
    </Section>
  );
}

function DemoCta() {
  return (
    <div className="demo-cta wrap">
      <div>
        <strong>Put the checkpoint in your real AI workflow.</strong>
        <span>Add the extension to supported chats in a few deliberate steps.</span>
      </div>
      <DownloadButton className="button" label="Download Extension" icon />
    </div>
  );
}

function Workflow() {
  return (
    <Section
      id="how-it-works"
      kicker="How it works"
      title="A local checkpoint in the moments that matter"
      intro="DebugHalo steps in only when you submit supported composer text."
    >
      <ol className="workflow">
        {workflow.map((step, index) => (
          <li key={step}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{step}</strong>
            {index < workflow.length - 1 && <i aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function WhyDebugHalo() {
  return (
    <Section
      id="why"
      kicker="Why DebugHalo"
      title="Security you can see and control"
      intro="Clear findings and explicit choices make protection understandable—not invisible."
    >
      <div className="reason-grid">
        {reasons.map(([title, body], index) => (
          <Reveal key={title}>
            <article className={`reason-card ${index === 0 ? 'primary' : ''}`}>
              <div className="reason-topline">
                <span className="reason-marker">
                  <ReasonIcon index={index} />
                </span>
                <span className="reason-number">0{index + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <TechnicalProof />
    </Section>
  );
}

function ReasonIcon({ index }: { index: number }) {
  if (index === 0) return <LockIcon />;
  if (index === 1) return <GithubIcon />;
  if (index === 2) return <CheckIcon />;
  return <ArrowIcon />;
}

function TechnicalProof() {
  return (
    <div className="proof-strip" aria-label="DebugHalo technical validation">
      {proofItems.map(([value, label]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
      <ExternalLink href={release.repositoryUrl}>
        Verify on GitHub <ArrowIcon />
      </ExternalLink>
    </div>
  );
}

function Catches() {
  return (
    <Section
      id="coverage"
      kicker="Detection coverage"
      title="What DebugHalo catches"
      intro="Purpose-built detectors recognize high-value secret and sensitive-data categories without exposing real credentials in this page."
    >
      <div className="catch-grid">
        {caughtExamples.map(([category, example]) => (
          <article key={category}>
            <span>
              <ShieldIcon /> {category}
            </span>
            <code>{example}</code>
          </article>
        ))}
      </div>
    </Section>
  );
}

function Features() {
  return (
    <Section id="features" kicker="Built for control" title="A clear decision, not a black box">
      <div className="feature-grid">
        {features.map(([title, body], index) => (
          <Reveal key={title}>
            <article className="feature-card">
              <span className="feature-number">0{index + 1}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <div className="cli-ribbon">
        <div>
          <TerminalIcon />
          <span>Developer workflow included</span>
        </div>
        <code>npx debug-halo scan . --fail-on-findings</code>
      </div>
    </Section>
  );
}

function Supported() {
  return (
    <Section
      id="supported"
      kicker="Supported AI"
      title="Protection where you already work"
      intro="Consistent review and sanitization across three supported browser experiences."
    >
      <div className="platform-grid">
        <Platform name="ChatGPT" letter="O" detail="chatgpt.com" />
        <Platform name="Claude" letter="A" detail="claude.ai" />
        <Platform name="Gemini" letter="G" detail="gemini.google.com" />
      </div>
      <p className="affiliation">
        DebugHalo is an independent project and is not affiliated with or endorsed by these
        platforms.
      </p>
    </Section>
  );
}

function Platform({ name, letter, detail }: { name: string; letter: string; detail: string }) {
  return (
    <article className={`platform platform-${name.toLowerCase()}`}>
      <div className="platform-mark">{letter}</div>
      <div>
        <h3>{name}</h3>
        <p>{detail}</p>
        <ul>
          <li>Live text protection</li>
          <li>Review and sanitize</li>
        </ul>
      </div>
      <span>
        <CheckIcon /> Protection ready
      </span>
    </article>
  );
}

function Architecture() {
  const steps = [
    'User types',
    'DebugHalo extension',
    'Local scan',
    'Review / sanitize',
    'AI provider',
  ];
  return (
    <Section
      id="architecture"
      kicker="Local protection path"
      title="A checkpoint before the provider"
      intro="DebugHalo processes supported composer text locally before an approved submission continues to the AI site."
    >
      <ol className="architecture-flow">
        {steps.map((step, index) => (
          <li key={step} className={step === 'Local scan' ? 'local-step' : ''}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
            {index < steps.length - 1 && <ArrowIcon />}
          </li>
        ))}
      </ol>
      <p className="architecture-note">
        <LockIcon /> Sensitive content stays inside the browser during DebugHalo processing.
      </p>
    </Section>
  );
}

function Privacy() {
  const promises = [
    'Scanning happens locally',
    'Sanitization happens locally',
    'No cloud DebugHalo scanner',
    'No raw message or secret persistence',
  ];
  return (
    <section className="privacy-section" id="privacy">
      <div className="wrap privacy-grid">
        <Reveal>
          <div className="privacy-copy">
            <div className="eyebrow">
              <span className="pulse" /> Privacy is the architecture
            </div>
            <h2>Your message stays in your browser while DebugHalo scans it.</h2>
            <p>
              There is no DebugHalo content backend, account system, analytics pipeline, or message
              telemetry. The extension stores preferences and safe numeric session counters—never
              your composer text.
            </p>
            <div className="privacy-list">
              {promises.map((item) => (
                <div key={item}>
                  <CheckIcon /> {item}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
        <div className="privacy-viz">
          <div className="browser-boundary">
            <div className="boundary-label">Your browser</div>
            <Logo large />
            <strong>Local scan</strong>
            <div className="data-path">
              <span>composer text</span>
              <ArrowIcon />
              <span>decision</span>
            </div>
          </div>
          <div className="no-cloud">
            <CloudIcon />
            <span>No content sent to DebugHalo</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScopeLimits() {
  const limits = [
    'File attachment contents',
    'Image contents',
    'Arbitrary desktop applications',
    'Unsupported AI sites',
  ];
  return (
    <section className="scope-section wrap" aria-labelledby="scope-title">
      <div>
        <span className="section-kicker">Current scope</span>
        <h2 id="scope-title">Focused on supported text composers today.</h2>
        <p>DebugHalo currently protects text composer content on supported AI sites.</p>
      </div>
      <div className="scope-card">
        <strong>Not scanned yet</strong>
        <ul>
          {limits.map((limit) => (
            <li key={limit}>
              <InfoIcon /> {limit}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Install() {
  return (
    <Section
      id="install"
      kicker="Get DebugHalo"
      title="Install in a few deliberate steps"
      intro="Until a Chrome Web Store listing is available, DebugHalo installs as an unpacked Chrome/Chromium extension."
    >
      <div className="download-card">
        <div>
          <span className="release-pill">Latest stable: {release.version}</span>
          <h3>DebugHalo Browser Extension</h3>
          <p>Chrome / Chromium · Manual install required</p>
          <small>Downloads come directly from the official DebugHalo GitHub Release.</small>
        </div>
        <div className="download-actions">
          <DownloadButton className="button" label="Download for Chrome / Chromium" icon />
          <ExternalLink href={release.releaseUrl}>
            View release notes <ArrowIcon />
          </ExternalLink>
        </div>
      </div>
      <div className="artifact-row">
        <span>Release artifact</span>
        <code>{release.fileName}</code>
        <ExternalLink href={release.releaseUrl}>
          Verify release <ArrowIcon />
        </ExternalLink>
      </div>
      <ol className="install-grid">
        {installSteps.map(([title, body], index) => (
          <li key={title}>
            <span>{index + 1}</span>
            <h3>{title}</h3>
            <p>{body}</p>
            {title === 'Open extensions' && <code>chrome://extensions</code>}
          </li>
        ))}
      </ol>
      <p className="install-note">
        <InfoIcon /> Developer mode is currently required because DebugHalo is not yet published in
        the Chrome Web Store.
      </p>
      <div className="install-success">
        <CheckIcon />
        <div>
          <strong>Installation complete</strong>
          <span>DebugHalo is now protecting supported AI chats.</span>
        </div>
      </div>
    </Section>
  );
}

function Cli() {
  return (
    <Section
      id="cli"
      kicker="For developer workflows"
      title="The same security mindset, from the terminal"
    >
      <div className="terminal">
        <div className="terminal-bar">
          <span />
          <span />
          <span />
          <b>~/your-project</b>
        </div>
        <pre>
          <span>$</span> npm install --save-dev debug-halo{`\n`}
          <span>$</span> npx debug-halo scan .{`\n`}
          <i>✓ Scanned locally · no findings</i>
          {`\n\n`}
          <span>$</span> npx debug-halo sanitize . --dry-run
        </pre>
      </div>
      <div className="cli-copy">
        <h3>Scan before code ships.</h3>
        <p>
          Use DebugHalo in local development, staged Git workflows, and CI—without making the
          browser extension carry developer tooling concerns.
        </p>
        <ExternalLink className="inline-link" href={`${release.repositoryUrl}#readme`}>
          Read the CLI documentation <ArrowIcon />
        </ExternalLink>
      </div>
    </Section>
  );
}

function Roadmap() {
  const items = [
    'Attachment scanning',
    'Response restoration',
    'Local extension vault',
    'VS Code integration',
    'Desktop protection',
    'Additional AI platforms',
  ];
  return (
    <Section
      id="roadmap"
      kicker="What’s next"
      title="A focused path forward"
      intro="These are roadmap directions—not features in the current release."
    >
      <div className="roadmap-list">
        {items.map((item, index) => (
          <div key={item}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            {item}
          </div>
        ))}
      </div>
    </Section>
  );
}

function FinalCta() {
  return (
    <section className="final-cta wrap">
      <div className="halo-ring" />
      <Logo large />
      <h2>Keep sensitive text on your side of send.</h2>
      <p>Local protection for ChatGPT, Claude, and Gemini.</p>
      <div className="hero-actions">
        <DownloadButton className="button" icon />
        <ExternalLink className="button secondary" href={release.repositoryUrl}>
          Explore the source
        </ExternalLink>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="wrap footer-grid">
        <div>
          <a className="brand" href="#top">
            <Logo /> DebugHalo
          </a>
          <p>Stop secrets before they reach AI.</p>
        </div>
        <div className="footer-links">
          <ExternalLink href={release.repositoryUrl}>GitHub</ExternalLink>
          <ExternalLink href={release.releasesUrl}>Releases</ExternalLink>
          <ExternalLink href={`${release.repositoryUrl}#readme`}>Documentation</ExternalLink>
          <ExternalLink href={release.securityUrl}>Security</ExternalLink>
          <ExternalLink href={release.licenseUrl}>MIT License</ExternalLink>
          <a href="#supported">Supported sites</a>
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>DebugHalo · Independent open-source privacy tooling</span>
        <span>{release.version}</span>
      </div>
    </footer>
  );
}

function Section({
  id,
  kicker,
  title,
  intro,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section className="section wrap" id={id}>
      <Reveal>
        <div className="section-heading">
          <span>{kicker}</span>
          <h2>{title}</h2>
          {intro && <p>{intro}</p>}
        </div>
      </Reveal>
      {children}
    </section>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !('IntersectionObserver' in window)) {
      node?.classList.add('visible');
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.classList.add('visible');
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="reveal" ref={ref}>
      {children}
    </div>
  );
}

function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function DownloadButton({
  className,
  label = 'Download Extension',
  icon = false,
  onClick,
}: {
  className?: string;
  label?: string;
  icon?: boolean;
  onClick?: () => void;
}) {
  return (
    <a className={className} href={release.downloadUrl} onClick={onClick}>
      {icon && <DownloadIcon />} {label}
    </a>
  );
}

function Logo({ large = false }: { large?: boolean }) {
  return (
    <svg className={`logo ${large ? 'large' : ''}`} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M32 7 53 17v15c0 13-8.4 22-21 27C19.4 54 11 45 11 32V17L32 7Z" />
      <path d="M20 32h7l4-10 5 20 4-10h5" />
    </svg>
  );
}
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}
function DownloadIcon() {
  return (
    <Icon>
      <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 20h14" />
    </Icon>
  );
}
function GithubIcon() {
  return (
    <Icon>
      <path d="M15 22v-4c.1-1-.4-2-1-2.5 3 0 6-1.5 6-6A4.7 4.7 0 0 0 19 6c.3-1 .3-2-.1-3 0 0-1 0-3 1.5a11 11 0 0 0-6 0C8 3 7 3 7 3c-.4 1-.4 2-.1 3A4.7 4.7 0 0 0 6 9.5c0 4.5 3 6 6 6-.5.4-.8 1-.9 1.7-.1.6-.1 3.8-.1 4.8M9 19c-3 .9-3-1.5-4-2" />
    </Icon>
  );
}
function LockIcon() {
  return (
    <Icon>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Icon>
  );
}
function ShieldIcon() {
  return (
    <Icon>
      <path d="M12 3 20 7v5c0 5-3.2 8-8 10-4.8-2-8-5-8-10V7l8-4Z" />
      <path d="m9 12 2 2 4-5" />
    </Icon>
  );
}
function CheckIcon() {
  return (
    <Icon>
      <path d="m5 12 4 4L19 6" />
    </Icon>
  );
}
function ArrowIcon() {
  return (
    <Icon>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </Icon>
  );
}
function PaperclipIcon() {
  return (
    <Icon>
      <path d="m20 12-8 8a6 6 0 0 1-8-8l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 0 1-3-3l8-8" />
    </Icon>
  );
}
function ReplayIcon() {
  return (
    <Icon>
      <path d="M4 12a8 8 0 1 0 2-5.3L4 9m0-5v5h5" />
    </Icon>
  );
}
function TerminalIcon() {
  return (
    <Icon>
      <path d="m5 7 4 4-4 4m7 0h7" />
    </Icon>
  );
}
function CloudIcon() {
  return (
    <Icon>
      <path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11-2A5 5 0 0 0 7 18Z" />
      <path d="m8 8 8 8m0-8-8 8" />
    </Icon>
  );
}
function InfoIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-9h.01" />
    </Icon>
  );
}

export { INITIAL_MESSAGE, SANITIZED_MESSAGE };
