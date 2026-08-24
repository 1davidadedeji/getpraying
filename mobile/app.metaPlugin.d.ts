export function isPlaceholderMetaAppId(appId: string): boolean;
export function isPlaceholderMetaClientToken(token: string): boolean;
export function metaPluginFromEnv(
  env: Record<string, string | undefined>,
): Array<string | [string, Record<string, unknown>]>;
