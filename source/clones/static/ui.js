const { Controller, config } = $scramjetController;

config.injectPath = "/controller/controller.inject.js";

const DISCORD_URL = "https://discord.com/app";
const DISCORD_FAVICON = "https://discord.com/favicon.ico";

let controller;
let frame;

function setFavicon(url) {
	if (!url) return;

	let link = document.querySelector("link[rel='icon']") || document.querySelector("link[rel='shortcut icon']");
	if (!link) {
		link = document.createElement("link");
		link.rel = "icon";
		document.head.appendChild(link);
	}

	link.href = url;
}

function getWispUrl() {
	const protocol = location.protocol === "https:" ? "wss" : "ws";
	return globalThis?._CONFIG?.wispurl || `${protocol}://${location.host}/wisp/`;
}

async function waitForControllerOrReady(registration, timeoutMs = 10000) {
	if (navigator.serviceWorker.controller) return;

	const ready = navigator.serviceWorker.ready.then(() => {});
	const controllerChanged = new Promise((resolve) => {
		const onChange = () => {
			navigator.serviceWorker.removeEventListener("controllerchange", onChange);
			resolve();
		};
		navigator.serviceWorker.addEventListener("controllerchange", onChange, { once: true });
	});
	const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));

	await Promise.race([ready, controllerChanged, timeout]);

	if (!navigator.serviceWorker.controller && registration.active) {
		await new Promise((resolve) => {
			navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), { once: true });
		});
	}
}

async function initController() {
	const registration = await navigator.serviceWorker.register("/sw.js");
	await waitForControllerOrReady(registration);

	const serviceworker = navigator.serviceWorker.controller ?? registration.active;
	if (!serviceworker) {
		throw new Error("No service worker available for controller initialization.");
	}

	const LibcurlClient = globalThis?.LibcurlTransport?.LibcurlClient;
	if (!LibcurlClient) {
		throw new Error("Libcurl transport is unavailable.");
	}

	controller = new Controller({
		serviceworker,
		transport: new LibcurlClient({
			wisp: getWispUrl(),
		}),
	});

	await controller.wait();
	frame = controller.createFrame();
}

function mountFrame(body) {
	const frameElement = frame.element || frame.frame;
	if (!frameElement) {
		throw new Error("ScramJet frame element was not created.");
	}
	frameElement.style.width = "100vw";
	frameElement.style.height = "100vh";
	frameElement.style.margin = "0";
	frameElement.style.border = "none";
	frameElement.style.display = "block";
	body.appendChild(frameElement);
}

function setupTitleListener() {
	let lastTitle = document.title;
	
	window.addEventListener("message", (event) => {
		if (event.data && event.data.type === "TITLE_CHANGE") {
			document.title = event.data.title;
			lastTitle = event.data.title;
		}
		if (event.data && event.data.type === "FAVICON_CHANGE") {
			const url = event.data.favicon;
			setFavicon(url);
		}
	});
	
	setInterval(() => {
		try {
			const frameElement = frame.element || frame.frame;
			if (frameElement && frameElement.contentDocument) {
				const frameTitle = frameElement.contentDocument.title;
				if (frameTitle && frameTitle !== lastTitle) {
					document.title = frameTitle;
					lastTitle = frameTitle;
				}
			}
		} catch (e) {
		}
	}, 500);
}

document.addEventListener("DOMContentLoaded", async function() {
	const body = document.getElementById("app");

	try {
		await initController();
		mountFrame(body);
		setupTitleListener();
		setFavicon(DISCORD_FAVICON);
		frame.go(DISCORD_URL);
	} catch (error) {
		console.error("Failed to initialize ScramJet controller:", error);
	}
});
