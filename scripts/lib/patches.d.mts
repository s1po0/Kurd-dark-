// Types for the plain-JS patch module, so the TypeScript tests stay strict.
export declare class PatchError extends Error {
  constructor(file: string, message: string);
}
export declare function patchManifest(xml: string): string;
export declare function patchMainActivity(java: string): string;
export declare function patchStyles(xml: string): string;
export declare function patchVariables(gradle: string): string;
export declare function patchAppBuild(
  gradle: string,
  identity: { versionCode: number; versionName: string },
): string;
export declare function patchSigning(gradle: string): string;
export declare const PATCH_CONSTANTS: { MIN_SDK: number };
