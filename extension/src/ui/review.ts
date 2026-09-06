import type { DetectionResult, SanitizationResult } from '../../../src/browser/index.js';

export type ReviewDecision =
  | { action: 'cancel' }
  | { action: 'send-original' }
  | { action: 'send-sanitized'; sanitizedText: string };

export interface ReviewRequest {
  findings: ReadonlyArray<DetectionResult>;
  originalText: string;
  sanitize: (text: string) => Promise<SanitizationResult>;
}

export type ReviewPresenter = (request: ReviewRequest) => Promise<ReviewDecision>;

export function showReview(document: Document, request: ReviewRequest): Promise<ReviewDecision> {
  return new Promise((resolve) => {
    removeExistingDialog(document);
    const { overlay, panel } = createDialog(document, 'Sensitive content detected');

    const summary = document.createElement('p');
    summary.textContent = `DebugHalo found ${request.findings.length} sensitive item(s). Review or sanitize before sending.`;
    panel.append(summary);

    const findings = document.createElement('div');
    findings.dataset['debughaloFindings'] = 'true';
    for (const finding of request.findings) findings.append(createFinding(document, finding));
    panel.append(findings);

    const details = document.createElement('div');
    details.hidden = true;
    details.dataset['debughaloDetails'] = 'true';
    for (const finding of request.findings) {
      const detail = document.createElement('p');
      const location = finding.range?.startLine ? ` Line ${finding.range.startLine}.` : '';
      const reason = finding.reason ? redactValues(finding.reason, request.findings) : '';
      detail.textContent = `${finding.detectorName}.${location}${reason ? ` ${reason}` : ''}`;
      details.append(detail);
    }
    panel.append(details);

    const preview = document.createElement('section');
    preview.hidden = true;
    preview.dataset['debughaloPreview'] = 'true';
    const previewHeading = document.createElement('h3');
    previewHeading.textContent = 'Sanitized message preview';
    const previewNote = document.createElement('p');
    previewNote.textContent =
      'This modified text will replace the ChatGPT composer before sending.';
    const previewText = document.createElement('pre');
    previewText.dataset['debughaloPreviewText'] = 'true';
    preview.append(previewHeading, previewNote, previewText);
    panel.append(preview);

    const actions = document.createElement('div');
    actions.style.cssText =
      'display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;margin-top:16px';
    const cancel = actionButton(document, 'Cancel');
    const review = actionButton(document, 'Review findings');
    const sanitize = actionButton(document, 'Sanitize');
    const send = actionButton(document, 'Send Anyway');
    const back = actionButton(document, 'Back to editing');
    const confirm = actionButton(document, 'Confirm Sanitized Send');
    back.hidden = true;
    confirm.hidden = true;

    let sanitizedText: string | undefined;
    const finish = (decision: ReviewDecision): void => {
      document.removeEventListener('keydown', onKeyDown, true);
      overlay.remove();
      resolve(decision);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') finish({ action: 'cancel' });
    };
    document.addEventListener('keydown', onKeyDown, true);

    cancel.addEventListener('click', () => finish({ action: 'cancel' }), { once: true });
    send.addEventListener('click', () => finish({ action: 'send-original' }), { once: true });
    review.addEventListener('click', () => {
      details.hidden = !details.hidden;
      review.textContent = details.hidden ? 'Review findings' : 'Hide details';
    });
    sanitize.addEventListener('click', async () => {
      sanitize.disabled = true;
      sanitize.textContent = 'Sanitizing locally…';
      try {
        const result = await request.sanitize(request.originalText);
        sanitizedText = result.sanitizedText;
        previewText.textContent = sanitizedText;
        findings.hidden = true;
        details.hidden = true;
        review.hidden = true;
        sanitize.hidden = true;
        send.hidden = true;
        preview.hidden = false;
        back.hidden = false;
        confirm.hidden = false;
        confirm.focus();
      } catch {
        sanitize.disabled = false;
        sanitize.textContent = 'Sanitize';
        summary.textContent = 'DebugHalo could not sanitize this message locally.';
      }
    });
    back.addEventListener('click', () => finish({ action: 'cancel' }), { once: true });
    confirm.addEventListener(
      'click',
      () => {
        if (sanitizedText !== undefined) finish({ action: 'send-sanitized', sanitizedText });
      },
      { once: true }
    );

    actions.append(cancel, review, sanitize, send, back, confirm);
    panel.append(actions);
    document.documentElement.append(overlay);
    cancel.focus();
  });
}

export function showScanFailure(document: Document): Promise<'cancel' | 'send'> {
  return showSimpleDecision(
    document,
    'DebugHalo could not complete the local scan',
    'The message remains blocked unless you explicitly choose Send Anyway.'
  );
}

export function showComposerChanged(document: Document): void {
  removeExistingDialog(document);
  const { overlay, panel } = createDialog(document, 'Composer changed');
  const message = document.createElement('p');
  message.textContent =
    'Nothing was sent or replaced. Review the current message and submit again.';
  const close = actionButton(document, 'Return to editing');
  close.addEventListener('click', () => overlay.remove(), { once: true });
  panel.append(message, close);
  document.documentElement.append(overlay);
  close.focus();
}

function showSimpleDecision(
  document: Document,
  heading: string,
  message: string
): Promise<'cancel' | 'send'> {
  return new Promise((resolve) => {
    removeExistingDialog(document);
    const { overlay, panel } = createDialog(document, heading);
    const copy = document.createElement('p');
    copy.textContent = message;
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px';
    const cancel = actionButton(document, 'Cancel');
    const send = actionButton(document, 'Send Anyway');
    const finish = (decision: 'cancel' | 'send'): void => {
      overlay.remove();
      resolve(decision);
    };
    cancel.addEventListener('click', () => finish('cancel'), { once: true });
    send.addEventListener('click', () => finish('send'), { once: true });
    actions.append(cancel, send);
    panel.append(copy, actions);
    document.documentElement.append(overlay);
    cancel.focus();
  });
}

function createDialog(
  document: Document,
  title: string
): { overlay: HTMLDivElement; panel: HTMLElement } {
  const overlay = document.createElement('div');
  overlay.dataset['debughaloWarning'] = 'true';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'debughalo-dialog-title');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;background:rgba(0,0,0,.68);padding:20px';

  const panel = document.createElement('section');
  panel.style.cssText =
    'max-width:560px;max-height:min(720px,90vh);overflow:auto;width:100%;box-sizing:border-box;background:Canvas;color:CanvasText;border:1px solid GrayText;border-radius:12px;padding:20px;font:14px/1.45 system-ui,sans-serif;box-shadow:0 16px 48px rgba(0,0,0,.4)';
  const heading = document.createElement('h2');
  heading.id = 'debughalo-dialog-title';
  heading.textContent = title;
  heading.style.margin = '0 0 12px';
  panel.append(heading);
  overlay.append(panel);
  return { overlay, panel };
}

function createFinding(document: Document, finding: DetectionResult): HTMLElement {
  const item = document.createElement('article');
  item.dataset['debughaloFinding'] = 'true';
  item.style.cssText =
    'border:1px solid GrayText;border-left:5px solid currentColor;border-radius:8px;padding:10px;margin:8px 0';
  const category = document.createElement('strong');
  category.textContent = finding.category;
  const metadata = document.createElement('div');
  metadata.textContent = `${(finding.severity ?? 'unknown').toUpperCase()} · ${Math.round(finding.confidence * 100)}% confidence`;
  item.append(category, metadata);
  return item;
}

function actionButton(document: Document, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.style.cssText =
    'border:1px solid ButtonBorder;border-radius:6px;padding:7px 10px;background:ButtonFace;color:ButtonText;cursor:pointer';
  return button;
}

function removeExistingDialog(document: Document): void {
  document.querySelector('[data-debughalo-warning]')?.remove();
}

function redactValues(text: string, findings: ReadonlyArray<DetectionResult>): string {
  let safeText = text;
  for (const finding of findings) {
    if (finding.value) safeText = safeText.replaceAll(finding.value, '[redacted]');
  }
  return safeText;
}
