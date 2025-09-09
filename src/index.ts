export interface HttpAdapter {
  listen(
    endpoint: string,
    handler: (req: any, res: any) => Promise<any>,
    ...args: any[]
  ): Promise<any> | any;

  getRequestBody(req: any): Promise<Uint8Array>;
}

export interface HttpAdapterRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
}

export interface HttpAdapterSererResponse {
  headersSent: boolean;
  writeHead(status: number, headers?: Record<string, string>): void;
  end(chunk?: string): void;
}

class WorkerServerResponse implements HttpAdapterSererResponse {
  private statusCode = 200;
  private headers: Record<string, string> = {};
  private chunks: Uint8Array<ArrayBuffer>[] = [];

  public headersSent: boolean = false;
  private resolved = false;
  private resolveResponsePromise?: () => void;

  writeHead(status: number, headers?: Record<string, string>) {
    if (this.headersSent) {
      throw new Error("Cannot modify headers after they have been sent.");
    }
    this.statusCode = status;
    if (headers) Object.assign(this.headers, headers);
  }

  end(chunk?: string) {
    if (this.headersSent) {
      throw new Error("Cannot send body after headers have been sent.");
    }
    if (chunk) this.chunks.push(new TextEncoder().encode(chunk));
    this.headersSent = true;
    if (!this.resolved) {
      this.resolved = true;

      if (this.resolveResponsePromise) {
        this.resolveResponsePromise(); // promise revoled
      }
    }
  }

  toResponse(): Response {
    const body = this.chunks.length ? new Blob(this.chunks) : null;
    return new Response(body, {
      status: this.statusCode,
      headers: this.headers,
    });
  }
  async waitForResponse(): Promise<void> {
    return new Promise((resolve) => {
      if (this.resolved) {
        resolve();
      } else {
        this.resolveResponsePromise = resolve; // Resolve when end() is called
      }
    });
  }
}

class WorkerIncomingMessage implements HttpAdapterRequest {
  headers: Record<string, string | string[]> = {};
  url: string;
  method: string;
  constructor(private request: Request) {
    request.headers.get("test");
    request.headers.forEach((value, key) => {
      this.headers[key] = value;
    });
    /*
     * "https://domain.name/endpoint/endpoint1?query=124".split('/') => ["https", "", "endpoint", "endpoint2?query=123"]
     * .slice(3) => ["endpoint", "endpoint2"]
     * join('/') => endpoint/endpoint2?query=123
     *  "/" + endpoint/endpoint2?query=123  => /endpoint/endpoint2?query=123
     */
    this.url = "/" + request.url.split("/").slice(3).join("/");
    this.method = request.method;
    this.request = request;
  }
  arrayBuffer(): Promise<ArrayBuffer> {
    return this.request.arrayBuffer();
  }
}

/**
 * Adapter for using discord.https with Cloudflare Workers.
 *
 * This class implements the HttpAdapter interface and provides
 * methods to handle incoming requests and send responses in a
 * Cloudflare Worker environment.
 *
 *
 *
 * @example
 * const adapter = new CloudflareAdapter();
 *
 * export default {
 *   // Cloudflare Workers entry point
 *   async fetch(request, env, ctx) {
 *     const client = new Client({
 *       token: env.DISCORD_BOT_TOKEN,
 *       publicKey: env.DISCORD_PUBLIC_KEY,
 *       httpAdapter: adapter,
 *       debug: true,
 *     });
 *
 *     // Register your routes
 *     client.register(UtilityRoute, HelloRoute);
 *
 *     // Handle Discord interactions on the "/interactions" endpoint
 *     return await client.listen("interactions", request);
 *   }
 * }
 */

class CloudflareAdapter implements HttpAdapter {
  /**
   *
   * @internal
   *
   */
  async listen(
    endpoint: string,
    handler: (req: any, res: any) => Promise<void>,
    request: Request
  ) {
    const req = new WorkerIncomingMessage(request);
    const res = new WorkerServerResponse();

    // It took almost an entire hour to debug this...
    // Weirdly, although res.waitForResponse() is blocking execution and waiting for the handler, which was working outside the javascript event loop,
    // Cloudflare just cancels the request for some reason??
    // Now, after adding await, it works?
    // Trust me, waitForResponse is blocking and will never allow execution to pass unless the .end() method from WorkerServerResponse is invoked.
    // Whatever, adding await to handler won't hurt...

    await handler(req, res);
    await res.waitForResponse();
    return res.toResponse();
  }

  /**
   *
   * Reads the request body as a Uint8Array.
   * @internal
   *
   */
  async getRequestBody(req: WorkerIncomingMessage): Promise<Uint8Array> {
    return req.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
}
export default CloudflareAdapter;
