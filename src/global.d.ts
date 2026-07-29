/// <reference types="vitest/globals" />
/// <reference types="node" />

declare module '*.json' {
  const value: {
    name: string;
    version: string;
    description: string;
    [key: string]: unknown;
  };
  export default value;
}

declare module '../package.json' {
  const value: {
    name: string;
    version: string;
    description: string;
    [key: string]: unknown;
  };
  export default value;
}
