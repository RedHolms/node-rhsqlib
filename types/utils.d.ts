///
/// Types utils
///

// Get all elements from array except for last
export type PopL<Arr extends any[]> = Arr extends [...infer L, infer _] ? L : [];
// Get last element from array
export type PopR<Arr extends any[]> = Arr extends [...infer _, infer R] ? R : never;

// Convers array of objects to map with "name" as the key
export type MapItems<I extends readonly { name: string }[]> = {
  [K in I[number] as K["name"]]: K
};

export type Equ<A,B> = A extends B ? B extends A ? true : false : false;

export type UndefinedToOptional<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]?: T[K];
} & {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};
