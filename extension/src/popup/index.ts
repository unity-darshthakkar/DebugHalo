import { scanText } from '../../../src/browser/index.js';

const input = requiredElement<HTMLTextAreaElement>('input');
const scanButton = requiredElement<HTMLButtonElement>('scan');
const summary = requiredElement<HTMLParagraphElement>('summary');
const findingsList = requiredElement<HTMLUListElement>('findings');

scanButton.addEventListener('click', () => {
  void scanInput();
});

async function scanInput(): Promise<void> {
  scanButton.disabled = true;
  summary.textContent = 'Scanning locally…';
  findingsList.replaceChildren();

  try {
    const findings = await scanText(input.value);
    summary.textContent = findings.length === 0 ? 'No findings.' : `${findings.length} finding(s).`;

    for (const finding of findings) {
      const item = document.createElement('li');
      const severity = finding.severity ?? 'unknown';
      item.textContent = `${finding.category} · ${severity} · ${Math.round(finding.confidence * 100)}%`;
      findingsList.append(item);
    }
  } catch (error) {
    summary.textContent = error instanceof Error ? error.message : 'Scan failed.';
  } finally {
    scanButton.disabled = false;
  }
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing extension element: ${id}`);
  return element as T;
}
