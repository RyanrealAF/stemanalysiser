import { Container, getContainer } from "@cloudflare/containers";

export class StemFlowContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "30m";
  enableInternet = true;
  pingEndpoint = "localhost/health";
  entrypoint = ["python", "/app/container_server.py"];
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const container = getContainer(env.STEMFLOW_CONTAINER, "stemflow-neural");
      return container.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};
