import { createBareServer } from "./node_modules/.pnpm/node_modules/@nebula-services/bare-server-node/dist/createServer.js";
import { createServer } from "http";
import Fastify from "./node_modules/.pnpm/node_modules/fastify/fastify.js";
import fastifyStatic from "./node_modules/.pnpm/node_modules/@fastify/static/index.js";
import { join } from "node:path";
import rspackConfig from "./rspack.config.ts";
import { rspack } from "@rspack/core";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { chmodSync, writeFileSync } from "fs";

const bare = createBareServer("/bare/", {
    logErrors: true,
    blockLocal: false,
});

wisp.options.allow_loopback_ips = true;
wisp.options.allow_private_ips = true;

const fastify = Fastify({
    serverFactory: (handler) => {
        return createServer()
            .on("request", (req, res) => {
                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

                if (bare.shouldRoute(req)) {
                    bare.routeRequest(req, res);
                } else {
                    handler(req, res);
                }
            })
            .on("upgrade", (req, socket, head) => {
                if (bare.shouldRoute(req)) {
                    bare.routeUpgrade(req, socket, head);
                } else {
                    wisp.routeRequest(req, socket, head);
                }
            });
    },
});

const libcurlDistPath = join(
    fileURLToPath(new URL(".", import.meta.url)),
    "./node_modules/.pnpm/node_modules/@mercuryworkshop/libcurl-transport/dist"
);

fastify.register(fastifyStatic, {
    root: join(fileURLToPath(new URL(".", import.meta.url)), "./static"),
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: join(fileURLToPath(new URL(".", import.meta.url)), "./packages/core/dist"),
    prefix: "/scramjet/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: join(fileURLToPath(new URL(".", import.meta.url)), "./packages/core/dist"),
    prefix: "/scram/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: join(fileURLToPath(new URL(".", import.meta.url)), "./packages/controller/dist"),
    prefix: "/controller/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: join(fileURLToPath(new URL(".", import.meta.url)), "./assets"),
    prefix: "/assets/",
    decorateReply: false,
});

fastify.register(fastifyStatic, {
    root: libcurlDistPath,
    prefix: "/libcurl/",
    decorateReply: false,
});

const PORT = Number(process.env.PORT) || 8080;

(async () => {
    try {
        await fastify.listen({
            port: PORT,
            host: "0.0.0.0",
        });

        console.log(`\n[SUCCESS] Server listening on 0.0.0.0:${PORT}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();

fastify.setNotFoundHandler((request, reply) => {
    console.error("PAGE PUNCHED THROUGH SW - " + request.url);
    reply.code(593).statusMessage("INVALID").send("punch through");
});

if (!process.env.CI) {
    try {
        writeFileSync(
            ".git/hooks/pre-commit",
            "pnpm prettier . -w\ngit update-index --again"
        );
        chmodSync(".git/hooks/pre-commit", 0o755);
    } catch {}
    const compiler = rspack(rspackConfig);
    compiler.watch({}, (err, stats) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(
            stats.toString({
                preset: "minimal",
                colors: true,
                version: false,
            })
        );
    });
}