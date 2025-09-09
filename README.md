# Cloudflare Adapter

[![npm version](https://img.shields.io/npm/v/@discordhttps/cloudflare-adapter.svg)](https://www.npmjs.com/package/@discordhttps/cloudflare-adapter)
[![License](https://img.shields.io/npm/l/@discordhttps/cloudflare-adapter.svg)](LICENSE)
[![Downloads](https://img.shields.io/npm/dm/@discordhttps/cloudflare-adapter.svg)](https://www.npmjs.com/package/@discordhttps/cloudflare-adapter)

**@discordhttps/cloudflare-adapter** is an adapter for integrating [**discordhttps**](https://www.npmjs.com/package/discordhttps) with [Cloudflare Workers](https://workers.cloudflare.com/).

## Installation

```bash
npm install @discordhttps/cloudflare-adapter discordhttps
```

## Usage

```typescript
import Client from "discordhttps";
import CloudflareAdapter from "@discordhttps/cloudflare-adapter";

import UtilityRoute from "./command/utility/index.js";
import HelloRoute from "./command/fun/hello.js";

const adapter = new CloudflareAdapter();

export default {
  // Cloudflare Workers entry point
  async fetch(request, env, ctx) {
    const client = new Client({
      token: env.DISCORD_BOT_TOKEN,
      publicKey: env.DISCORD_PUBLIC_KEY,
      httpAdapter: adapter,
      debug: true,
    });

    // Register your routes.
    client.register(UtilityRoute, HelloRoute);

    // Handle Discord interactions on the "/interactions" endpoint
    return await client.listen("interactions", request);
  },
};
```
