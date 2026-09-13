"use client";

import PusherClient from "pusher-js";

/**
 * The subset of the Pusher client the app actually uses. Declaring it lets the
 * SSR no-op below satisfy the return type without an `any` cast.
 */
export interface RealtimeChannel {
  bind<T>(event: string, callback: (data: T) => void): unknown;
  unbind<T>(event?: string, callback?: (data: T) => void): unknown;
}

export interface RealtimeClient {
  subscribe(channel: string): RealtimeChannel;
  unsubscribe(channel: string): unknown;
}

let clientInstance: PusherClient | null = null;

const ssrNoopClient: RealtimeClient = {
  subscribe: () => ({ bind: () => {}, unbind: () => {} }),
  unsubscribe: () => {},
};

export function getPusherClient(): RealtimeClient {
  // During SSR / prerendering there is no socket to open; hand back an inert client.
  if (typeof window === "undefined") return ssrNoopClient;

  if (!clientInstance) {
    clientInstance = new PusherClient(
      process.env.NEXT_PUBLIC_PUSHER_KEY || "temp-key",
      {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1",
      }
    );
  }

  return clientInstance;
}
