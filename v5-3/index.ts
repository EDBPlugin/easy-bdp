export default {

    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        const responseText = `Hello from Cloudflare Worker!
        Request Method: ${request.method}
        Request URL: ${url.pathname}`;

        return new Response(responseText, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
        });
    },
};

interface Env {
}
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
}
