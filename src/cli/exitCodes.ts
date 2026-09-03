export function scanExitCode(
  filesFailed: number,
  failOnFindings: boolean,
  findings: number
): 0 | 1 | 2 {
  if (filesFailed > 0) return 2;
  if (failOnFindings && findings > 0) return 1;
  return 0;
}

export function sanitizeExitCode(filesFailed: number, filesChanged: number): 0 | 1 | 2 {
  if (filesFailed > 0) return 2;
  if (filesChanged > 0) return 1;
  return 0;
}
