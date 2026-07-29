// Type utilities for the project

/**
 * Type-safe keys of an object
 */
export type KeysOf<T> = keyof T & string;

/**
 * Make all properties of T required recursively
 */
export type DeepRequired<T> = {
  [K in keyof T]-?: T[K] extends object ? DeepRequired<T[K]> : T[K];
};

/**
 * Make all properties of T optional recursively
 */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * Make specific properties required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract the type of array elements
 */
export type ArrayElement<T> = T extends (infer U)[] ? U : never;

/**
 * Make all properties of T non-nullable
 */
export type NonNullableKeys<T> = {
  [K in keyof T as NonNullable<T[K]> extends never ? never : K]: NonNullable<T[K]>;
};

/**
 * Make all properties of T nullable
 */
export type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

/**
 * Pick properties by value type
 */
export type PickByType<T, U> = Pick<
  T,
  { [K in keyof T]: T[K] extends U ? K : never }[keyof T] & keyof T
>;

/**
 * Omit properties by value type
 */
export type OmitByType<T, U> = Omit<
  T,
  { [K in keyof T]: T[K] extends U ? K : never }[keyof T] & keyof T
>;

/**
 * Make all properties readonly recursively
 */
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};

/**
 * Value of an object
 */
export type ValueOf<T> = T[keyof T];

/**
 * Keys of T that have value type U
 */
export type KeysOfType<T, U> = {
  [K in keyof T]: T[K] extends U ? K : never;
}[keyof T];

/**
 * Recursively flatten an object type
 */
export type Flatten<T> = T extends object ? { [K in keyof T]: Flatten<T[K]> } : T;

/**
 * Brand type for nominal typing
 */
export type Brand<T, B> = T & { __brand: B };

/**
 * Create a branded type
 */
export function brand<T, B>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}

/**
 * Check if a value has a brand
 * @param _brand - The brand to check for (unused in runtime check)
 */
export function hasBrand<T, B>(value: T, _brand: B): value is Brand<T, B> {
  void _brand;
  return typeof value === 'object' && value !== null && '__brand' in value;
}
