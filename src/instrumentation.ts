import type { Instrumentation } from "next";

/** Runs once per server start. Node-only work lives in ./instrumentation-node (never bundled for Edge). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportRequestError } = await import("./instrumentation-node");
    reportRequestError(error, request, context);
  }
};
