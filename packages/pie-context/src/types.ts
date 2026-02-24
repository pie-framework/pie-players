export type Context<KeyType, ValueType> = KeyType & { __context__: ValueType };

export type UnknownContext = Context<unknown, unknown>;

export type ContextType<T extends UnknownContext> =
	T extends Context<infer _K, infer V> ? V : never;

export type ContextCallback<ValueType> = (
	value: ValueType,
	unsubscribe?: () => void,
) => void;

export const createContext = <ValueType, KeyType = unknown>(key: KeyType) =>
	key as Context<KeyType, ValueType>;
