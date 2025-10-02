import { serve, type Server } from "bun";
import path from "path";
import mime from "mime-types";
import crypto from "crypto";

/**
 * The globally accessible framework for managing Hexley's web server interfaces.
 */
export const endpointFramework = {

    // Framework Logging Color
    frameworkColor: "#e9edc9",

    /**
     * Internal variable to store the Bun server instance.
     */
    _serverInstance: null as Server | null,

    /**
     * Helper function to log requests to the console with colored text.
     * @param {any} Hexley - The main Hexley global object.
     * @param {Request} request - The incoming request object.
     * @param {string} clientIp - The IP address of the client.
     * @param {string} filePath - The file path being requested.
     * @param {string} duration - The time taken to process the request in milliseconds.
     * @param {number} status - The HTTP status code of the response.
     * @param {string} outcome - A short description of the outcome (e.g., 'DENIED', 'API', 'SERVED', 'NOT_FOUND').
     */
    logEndpointRequest(Hexley: any, request: Request, clientIp: string, filePath: string, duration: string, status: number, outcome: string) {
        const { aurora } = Hexley.frameworks;
        const logColor = `#e9edc9`;
        
        let statusColor = '#00ff00'; // Green for success
        if (status >= 400) statusColor = '#ffff00'; // Yellow for client errors
        if (status >= 500) statusColor = '#ff0000'; // Red for server errors
        
        const coloredStatus = aurora.colorText(status, statusColor);

        Hexley.log(`${aurora.colorText(`[endpointFramework/logEndpointRequest]`, logColor)} ${request.method} ${aurora.colorText(filePath, logColor)} from ${aurora.colorText(clientIp, logColor)} -> ${outcome} (${coloredStatus}) (${aurora.colorText(`${duration}ms`, logColor)})`);
    },

    /**
     * Internal helper function to log API request data.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} apiName - The name of the API.
     * @param {any} data - The JSON data received in the request body.
     */
    _logApiData(Hexley: any, apiName: string, data: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText(`[endpointFramework/api/${apiName}]`, this.frameworkColor)} Received API data:`);
        // Log the JSON stringified data, with nice formatting
        Hexley.log(JSON.stringify(data, null, 2));
    },

    /**
     * Verifies the signature of a Twitch webhook request.
     * @param {any} Hexley - The main Hexley global object.
     * @param {Request} request - The incoming request.
     * @param {string} body - The raw request body as a string.
     * @param {string} secret - The webhook secret from the environment.
     * @returns {boolean} True if the signature is valid, false otherwise.
     */
    _verifyTwitchSignature(Hexley: any, request: Request, body: string, secret: string): boolean {
        const messageId = request.headers.get('Twitch-Eventsub-Message-Id');
        const timestamp = request.headers.get('Twitch-Eventsub-Message-Timestamp');
        const signature = request.headers.get('Twitch-Eventsub-Message-Signature');
        
        if (!messageId || !timestamp || !signature) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/twitch]', Hexley.frameworks.aurora.tintRed)} Missing required Twitch signature headers.`);
            return false;
        }

        const message = messageId + timestamp + body;
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(message);
        const expectedSignature = `sha256=${hmac.digest('hex')}`;

        if (signature !== expectedSignature) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/twitch]', Hexley.frameworks.aurora.tintRed)} Invalid Twitch signature.`);
            return false;
        }
        
        return true;
    },

    /**
     * Handles an incoming Twitch API request.
     * @param {any} Hexley - The main Hexley global object.
     * @param {any} request - The incoming request object.
     */
    async _handleTwitchWebhook(Hexley: any, request: Request) {
        const { TWITCH_WEBSOCKET_SECRET } = Hexley.modules.twitch.config;
        const bodyString = await request.text();

        // Check for EventSub challenge
        try {
            const body = JSON.parse(bodyString);
            if (body.challenge && body.subscription) {
                // This is a verification request from Twitch
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/twitch]', this.frameworkColor)} Received subscription verification request. Responding with challenge.`);
                return new Response(body.challenge, { status: 200 });
            }
        } catch (e) {
            // Not a JSON body or not a challenge request
        }

        // Verify the signature for all other EventSub requests
        if (!this._verifyTwitchSignature(Hexley, request, bodyString, TWITCH_WEBSOCKET_SECRET)) {
            return new Response('Invalid signature.', { status: 403 });
        }
        
        const data = JSON.parse(bodyString);
        // We now delegate the processing to the loaded twitch module
        if (Hexley.modules.twitch) {
            Hexley.modules.twitch.handleWebhook(Hexley, data);
        } else {
            this._logApiData(Hexley, 'twitch', data);
        }
        
        return new Response("OK", { status: 200 });
    },

    /**
     * Handles an incoming GitHub API request.
     * @param {any} Hexley - The main Hexley global object.
     * @param {any} data - The JSON data from the request body.
     */
    _handleGitHubWebhook(Hexley: any, data: any) {
        this._logApiData(Hexley, 'github', data);
    },

    /**
     * Initializes the Endpoint Framework and starts the web server.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initializeEndpoint(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/initializeEndpoint]', this.frameworkColor)} Initializing...`);

        if (this._serverInstance) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/initializeEndpoint]', this.frameworkColor)} Server is already running. Skipping initialization.`);
            return;
        }

        const webRoot = '/var/www';
        const allowedGetRoutes = ['/api/twitch'];
        // const allowedGetRoutes = ['/api/twitch', '/', '/index.html', '/debug.html'];

        const enableHttps = process.env.ENABLE_HTTPS?.toLowerCase() === 'true';
        const keyPath = process.env.HTTPS_KEY_PATH;
        const certPath = process.env.HTTPS_CERT_PATH;
        const desiredPort = process.env.ENDPOINT_PORT ? parseInt(process.env.ENDPOINT_PORT) : (enableHttps ? 443 : 3000);
        const hostname = process.env.ENDPOINT_IP || '0.0.0.0';

        const serverOptions: any = {
            port: desiredPort,
            hostname: hostname,
            async fetch(request: Request, server: any): Promise<Response> {
                const startTime = performance.now();
                const clientIp = server.requestIP(request)?.address || request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "Unknown IP";
                const sanitizedClientIp = clientIp.startsWith("::ffff:") ? clientIp.replace("::ffff:", "") : clientIp;
                
                let url: URL;
                try {
                    const host = request.headers.get('host') || 'localhost';
                    url = new URL(request.url, `http://${host}`);
                } catch (error) {
                    const duration = (performance.now() - startTime).toFixed(2);
                    endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, request.url, duration, 400, 'BAD_REQUEST');
                    return new Response("Bad Request", { status: 400, headers: { 'X-Internal-Resolve-Time': `${duration}ms` } });
                }

                const isAllowed = await Hexley.frameworks.firewall.inspectAddress(Hexley, sanitizedClientIp, url.pathname);
                if (!isAllowed) {
                    const duration = (performance.now() - startTime).toFixed(2);
                    endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, url.pathname, duration, 403, 'DENIED');
                    return new Response("Forbidden", { status: 403, headers: { 'X-Internal-Resolve-Time': `${duration}ms` } });
                }

                // Passed the firewall, we're going to handle this request
                await Hexley.frameworks.firewall.incrementTotalRequests(Hexley);

                if (request.method === 'POST') {
                    const duration = (performance.now() - startTime).toFixed(2);
                    switch (url.pathname) {
                        case '/api/twitch':
                            const twitchResponse = await endpointFramework._handleTwitchWebhook(Hexley, request);
                            endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, url.pathname, duration, twitchResponse.status, 'API');
                            return twitchResponse;
                        case '/api/github':
                            const githubData = await request.json();
                            endpointFramework._handleGitHubWebhook(Hexley, githubData);
                            endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, url.pathname, duration, 200, 'API');
                            return new Response("GitHub API endpoint handled.", { status: 200 });
                        default:
                            endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, url.pathname, duration, 404, 'NOT_FOUND');
                            return new Response("API not found.", { status: 404 });
                    }
                }

                if (request.method === 'GET') {
                    if (allowedGetRoutes.includes(url.pathname)) {
                        const duration = (performance.now() - startTime).toFixed(2);

                        if (url.pathname === '/api/twitch') {
                            endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, url.pathname, duration, 200, 'API');
                            return new Response("OK", { status: 200, headers: { 'X-Internal-Resolve-Time': `${duration}ms` } });
                        }

                        let filePath = path.join(webRoot, url.pathname === '/' ? 'index.html' : url.pathname);
                        const fileContent = Hexley.frameworks.filesystem.readFile(Hexley, filePath);
                        const found = !!fileContent;
                        
                        if (found) {
                            endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, url.pathname, duration, 200, 'SERVED');
                            const mimeType = mime.lookup(filePath) || 'application/octet-stream';
                            return new Response(fileContent, {
                                status: 200,
                                headers: { 'Content-Type': mimeType, 'X-Internal-Resolve-Time': `${duration}ms` }
                            });
                        } else {
                            endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, url.pathname, duration, 404, 'NOT_FOUND');
                            return new Response("Not Found", { status: 404, headers: { 'X-Internal-Resolve-Time': `${duration}ms` } });
                        }
                    }
                }

                // Deny all other methods and un-allowed GET requests
                const duration = (performance.now() - startTime).toFixed(2);
                endpointFramework.logEndpointRequest(Hexley, request, sanitizedClientIp, url.pathname, duration, 405, 'DENIED');
                return new Response("Method Not Allowed", { status: 405, headers: { 'X-Internal-Resolve-Time': `${duration}ms` } });
            },
        };

        if (enableHttps) {
            if (!keyPath || !certPath) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/initializeEndpoint]', this.frameworkColor)} HTTPS enabled, but key and/or cert paths are not specified in .env! Starting as HTTP.`);
            } else {
                serverOptions.key = await Bun.file(keyPath).text();
                serverOptions.cert = await Bun.file(certPath).text();
            }
        }

        try {
            this._serverInstance = serve(serverOptions);
            const protocol = enableHttps ? 'https' : 'http';
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/initializeEndpoint]', this.frameworkColor)} EndpointFramework server is running on ${protocol}://${this._serverInstance.hostname}:${this._serverInstance.port}`);
        } catch (error) {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/initializeEndpoint]', this.frameworkColor)} Error starting the server: ${error}`);
            this._serverInstance = null;
        }

        Hexley.core.once('registryFramework.ready', async () => {
            const plistPath = path.join(Hexley.privateFrameworksRootPath, 'endpointFramework', 'info.plist');
            await Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
        });

        Hexley.versions['endpointFramework'] = { version: '1.0.0', type: 'Framework' };
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[endpointFramework/initializeEndpoint]', this.frameworkColor)} Endpoint Framework has been loaded!`);
    },

    getServer(): Server | null {
        return this._serverInstance;
    },
};
