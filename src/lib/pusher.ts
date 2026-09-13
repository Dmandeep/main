import Pusher from "pusher";

/**
 * Turbopack previously wrapped this CommonJS module such that the default export
 * arrived as `{ default: Pusher }` on the server, which crashed at import time
 * (commits 9fd785b, 24c50ba, 073de51). The interop below tolerates both shapes
 * without dropping back to `require()`.
 */
const PusherServer = (Pusher as unknown as { default?: typeof Pusher }).default ?? Pusher;

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});
