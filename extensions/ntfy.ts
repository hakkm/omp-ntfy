/**
 * omp-ntfy — Instant phone push notifications for oh-my-pi (omp) and pi via ntfy.sh.
 *
 * Highlights:
 * - 100% Free & Open Source: No accounts, no subscriptions, zero QR codes.
 * - Disabled by default: Starts silent on every new session.
 * - One-shot arming:
 *     /ntfy once       (notifies on next completion or question, then auto-disarms)
 *     /ntfy on         (continuous notifications for this session)
 *     /ntfy off        (disables notifications)
 *     /ntfy topic <id> (sets custom ntfy topic)
 *     /ntfy test       (sends a test notification to verify delivery)
 *     /ntfy status     (displays current arming state and topic)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

export type NtfyMode = "once" | "continuous";

export interface NtfyConfig {
	topic: string;
	server: string;
	maxTextLength: number;
}

const CONFIG_FILE = "omp-ntfy.json";

function getConfigPath(): string {
	const ompDir = path.join(os.homedir(), ".omp", "agent");
	if (fs.existsSync(ompDir)) {
		return path.join(ompDir, CONFIG_FILE);
	}
	return path.join(os.homedir(), ".pi", "agent", CONFIG_FILE);
}

function loadConfig(): NtfyConfig {
	const configPath = getConfigPath();
	try {
		if (fs.existsSync(configPath)) {
			const raw = fs.readFileSync(configPath, "utf8");
			return {
				topic: process.env.NTFY_TOPIC || "omp-alert",
				server: process.env.NTFY_SERVER || "https://ntfy.sh",
				maxTextLength: 350,
				...JSON.parse(raw),
			};
		}
	} catch {
		// Fallback
	}
	return {
		topic: process.env.NTFY_TOPIC || "omp-alert",
		server: process.env.NTFY_SERVER || "https://ntfy.sh",
		maxTextLength: 350,
	};
}

function saveConfig(cfg: NtfyConfig): void {
	const configPath = getConfigPath();
	try {
		fs.mkdirSync(path.dirname(configPath), { recursive: true });
		fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), "utf8");
	} catch (e) {
		console.error("[omp-ntfy] Failed to save config:", e);
	}
}

const ASK_TOOLS = new Set([
	"ask",
	"ask_user",
	"ask_user_question",
	"ask-user-question",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object";
}

function extractAssistantText(msg: unknown): string {
	if (!isRecord(msg)) return "";
	const content = msg.content;
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return content
			.filter((c): c is Record<string, unknown> => isRecord(c) && c.type === "text" && typeof c.text === "string")
			.map(c => c.text as string)
			.join("\n");
	}
	return "";
}

function cleanForNotification(text: string, maxLength: number): string {
	let cleaned = text
		.replace(/```[\s\S]*?```/g, "[code snippet]")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/#+\s+/g, "")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	if (cleaned.length > maxLength) {
		cleaned = cleaned.slice(0, maxLength - 3) + "...";
	}
	return cleaned;
}

function encodeHeaderValue(value: string): string {
	// Standard HTTP header values must be byte strings.
	// If non-ASCII characters (e.g. emojis) are present, encode using RFC 2047 Base64
	// which ntfy natively decodes on delivery.
	if (/[^\x00-\x7F]/.test(value)) {
		return `=?utf-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
	}
	return value;
}

export default function ntfyPlugin(pi: ExtensionAPI): void {
	// By default, DISABLED for every new session
	let enabled = false;
	let mode: NtfyMode = "once";
	const config: NtfyConfig = loadConfig();

	let lastQuestionAlertAt = 0;
	let settleCounter = 0;
	let lastAssistantText = "";

	/** Send push notification via ntfy */
	async function sendNtfy(
		message: string,
		options: {
			title?: string;
			priority?: "min" | "low" | "default" | "high" | "urgent";
			tags?: string;
		} = {}
	): Promise<{ success: boolean; detail?: string }> {
		if (!config.topic) {
			return { success: false, detail: "ntfy topic is not configured. Run: /ntfy topic <name>" };
		}

		const server = config.server.replace(/\/+$/, "");
		const url = `${server}/${encodeURIComponent(config.topic)}`;

		try {
			const rawTitle = options.title || "oh-my-pi";
			const headers: Record<string, string> = {
				Title: encodeHeaderValue(rawTitle),
				Priority: options.priority || "high",
				Tags: options.tags || "bell",
			};

			const resp = await fetch(url, {
				method: "POST",
				headers,
				body: message,
			});

			if (resp.ok) {
				return { success: true };
			}
			const body = await resp.text();
			return { success: false, detail: `HTTP ${resp.status}: ${body}` };
		} catch (err) {
			return { success: false, detail: String(err) };
		}
	}

	function handleDisarmIfOnce(ctx: ExtensionContext): void {
		if (mode === "once") {
			enabled = false;
			ctx.ui.notify(
				`📱 [omp-ntfy] Notification delivered to '${config.topic}'. Session alerts disarmed.`,
				"info"
			);
		}
	}

	// --------------------------------------------------------------------------
	// Event Listeners
	// --------------------------------------------------------------------------

	pi.on("input", () => {
		lastAssistantText = "";
		settleCounter++;
	});

	pi.on("agent_start", () => {
		lastAssistantText = "";
	});

	// Immediate Alert on User Question (Ask Tool)
	pi.on("tool_execution_start", async (event, ctx) => {
		if (!enabled) return;
		if (ASK_TOOLS.has(event.toolName)) {
			const now = Date.now();
			if (now - lastQuestionAlertAt < 3000) return;
			lastQuestionAlertAt = now;

			const args = event.args as Record<string, unknown> | undefined;
			const question = (args?.question || args?.prompt || args?.message || "User input requested") as string;
			const cleaned = cleanForNotification(question, 280);

			const res = await sendNtfy(`Question waiting for your answer:\n${cleaned}`, {
				title: "Question Waiting",
				priority: "urgent",
				tags: "bell,question",
			});

			if (res.success) {
				handleDisarmIfOnce(ctx);
			} else {
				ctx.ui.notify(`[omp-ntfy] Failed to send alert: ${res.detail}`, "warning");
			}
		}
	});

	// oh-my-pi fork: Tool permission / approval requested
	pi.on("tool_approval_requested" as never, async (event: unknown, ctx: ExtensionContext) => {
		if (!enabled) return;
		const toolName = isRecord(event) && typeof event.toolName === "string" ? event.toolName : "tool";

		const res = await sendNtfy(`Waiting for your approval to run tool: ${toolName}`, {
			title: "Tool Approval Required",
			priority: "high",
			tags: "bell,warning",
		});

		if (res.success) {
			handleDisarmIfOnce(ctx);
		}
	});

	// Capture assistant message
	pi.on("agent_end", (event) => {
		if (Array.isArray(event.messages) && event.messages.length > 0) {
			const last = event.messages[event.messages.length - 1];
			lastAssistantText = extractAssistantText(last);
		}
	});

	// Settle / Task Finished
	const onSettled = (ctx: ExtensionContext) => {
		if (!enabled) return;
		if (!ctx.isIdle() || ctx.hasPendingMessages()) return;

		const currentGeneration = ++settleCounter;

		// Quiet window: confirm agent is genuinely idle
		setTimeout(async () => {
			if (currentGeneration !== settleCounter) return;
			if (!ctx.isIdle() || ctx.hasPendingMessages()) return;

			let summary = cleanForNotification(lastAssistantText, config.maxTextLength);
			if (!summary) {
				summary = "Agent settled and task is completed.";
			}

			const res = await sendNtfy(`Task completed:\n${summary}`, {
				title: "Task Completed",
				priority: "high",
				tags: "bell,white_check_mark",
			});

			if (res.success) {
				handleDisarmIfOnce(ctx);
			} else {
				ctx.ui.notify(`[omp-ntfy] Failed to send completion alert: ${res.detail}`, "warning");
			}
		}, 300);
	};

	pi.on("agent_settled", (_event, ctx) => onSettled(ctx));
	pi.on("session_stop" as never, (_event: unknown, ctx: ExtensionContext) => onSettled(ctx));

	// --------------------------------------------------------------------------
	// Command Handler
	// --------------------------------------------------------------------------

	const handleCommand = async (argsStr: string, ctx: ExtensionContext) => {
		const args = argsStr.trim().split(/\s+/);
		const action = (args[0] || "").toLowerCase();

		switch (action) {
			case "once": {
				enabled = true;
				mode = "once";
				ctx.ui.notify(
					`🔔 ntfy ARMED (one-shot: will notify topic '${config.topic}' on next completion or question, then disarm).`,
					"info"
				);
				break;
			}
			case "on": {
				enabled = true;
				mode = "continuous";
				ctx.ui.notify(
					`🔔 ntfy ENABLED (continuous notifications to topic '${config.topic}').`,
					"info"
				);
				break;
			}
			case "off": {
				enabled = false;
				ctx.ui.notify(`🔕 ntfy notifications DISABLED.`, "info");
				break;
			}
			case "topic": {
				const topic = args[1];
				if (topic) {
					config.topic = topic;
					saveConfig(config);
					ctx.ui.notify(`ntfy topic updated to '${config.topic}'.`, "info");
				} else {
					ctx.ui.notify("Usage: /ntfy topic <topic_name>", "warning");
				}
				break;
			}
			case "server": {
				const server = args[1];
				if (server) {
					config.server = server;
					saveConfig(config);
					ctx.ui.notify(`ntfy server updated to '${config.server}'.`, "info");
				} else {
					ctx.ui.notify("Usage: /ntfy server <https://ntfy.sh or self-hosted>", "warning");
				}
				break;
			}
			case "test": {
				ctx.ui.notify(`Sending test push notification to '${config.topic}' via ${config.server}...`, "info");
				const res = await sendNtfy("This is a test notification from oh-my-pi! Everything is working.", {
					title: "Test Notification",
					priority: "high",
					tags: "bell",
				});
				if (res.success) {
					ctx.ui.notify(`✅ Test push notification delivered to topic '${config.topic}'! Check your phone.`, "info");
				} else {
					ctx.ui.notify(`❌ Test failed: ${res.detail}`, "error");
				}
				break;
			}
			case "status": {
				const stateStr = enabled ? `ENABLED (${mode})` : "DISABLED";
				const info = [
					`Status: ${stateStr}`,
					`Topic: ${config.topic}`,
					`Server: ${config.server}`,
					`Preview URL: ${config.server}/${config.topic}`,
				].join("\n");
				ctx.ui.notify(info, "info");
				break;
			}
			default: {
				ctx.ui.notify(
					`Usage:\n  /ntfy once         (arm for 1 alert until next completion/question)\n  /ntfy on           (keep enabled for session)\n  /ntfy off          (disable)\n  /ntfy test         (send test push notification)\n  /ntfy topic <name> (set topic name)\n  /ntfy status       (show current settings)`,
					"info"
				);
				break;
			}
		}
	};

	pi.registerCommand("ntfy", {
		description: "Toggle phone push notifications via ntfy.sh (default disabled)",
		handler: handleCommand,
	});
}
