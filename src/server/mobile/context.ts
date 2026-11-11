import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Set while the mobile API runs one of the web's server actions for the app (src/app/api/mobile/v1/actions).
 * The actions are the same code either way; this only switches off browser-only steps such as refresh().
 */
const mobileApi = new AsyncLocalStorage<true>();

export function runForMobile<T>(fn: () => Promise<T>): Promise<T> {
  return mobileApi.run(true, fn);
}

export function inMobileApi(): boolean {
  return mobileApi.getStore() === true;
}
