import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, debounce } from "obsidian";

// ---------------------------------------------------------------------------
// Settings — data contract
// ---------------------------------------------------------------------------

interface PluginSettings {
	baseUrl: string;
	vaultName: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	baseUrl: "",
	vaultName: "",
};

// ---------------------------------------------------------------------------
// Pure utility functions — no side effects, easily testable
// ---------------------------------------------------------------------------

/**
 * Normalizes a user-provided base URL into the canonical redirect endpoint.
 * Extracts the origin and appends /v1/open, unless already present.
 *
 * Examples:
 *   "https://link.example.com"            -> "https://link.example.com/v1/open"
 *   "https://link.example.com/"           -> "https://link.example.com/v1/open"
 *   "https://link.example.com/v1/open"    -> "https://link.example.com/v1/open"
 *   "https://link.example.com/v1/open/"   -> "https://link.example.com/v1/open"
 *   "https://link.example.com/wrong/path" -> "https://link.example.com/v1/open"
 */
function normalizeBaseUrl(input: string): string {
	const trimmed = input.trim().replace(/\/+$/, "");
	// Already has the canonical path — pass through
	if (trimmed.match(/\/v1\/open$/)) {
		return trimmed;
	}
	// Parse to extract origin, discard any incorrect path
	try {
		const parsed = new URL(trimmed);
		return parsed.origin + "/v1/open";
	} catch (_e) {
		// If URL parsing fails, best-effort append (validation catches bad URLs elsewhere)
		return trimmed + "/v1/open";
	}
}

/**
 * Returns true if the input looks like a valid HTTP(S) URL.
 */
function isValidHttpUrl(input: string): boolean {
	try {
		const url = new URL(input);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch (_e) {
		return false;
	}
}

/**
 * Constructs the canonical redirect URL for a given file path.
 * Format: {base}?vault={vault}&file={file}
 */
function buildRedirectUrl(settings: PluginSettings, filePath: string): string {
	const base = normalizeBaseUrl(settings.baseUrl);
	return `${base}?vault=${encodeURIComponent(settings.vaultName)}&file=${encodeURIComponent(filePath)}`;
}

// ---------------------------------------------------------------------------
// Plugin — lifecycle + registration only
// ---------------------------------------------------------------------------

export default class RedirectLinkPlugin extends Plugin {
	settings: PluginSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();

		// File explorer context menu: "Copy Redirect Link"
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile)) return;
				menu.addItem((item) => {
					item
						.setTitle("Copy Redirect Link")
						.setIcon("link")
						.onClick(() => this.copyRedirectLink(file));
				});
			})
		);

		// Command palette: "Copy Redirect Link" (active note)
		this.addCommand({
			id: "copy-redirect-link",
			name: "Copy Redirect Link",
			checkCallback: (checking: boolean) => {
				const file = this.app.workspace.getActiveFile();
				if (!file) return false;
				if (!checking) {
					this.copyRedirectLink(file);
				}
				return true;
			},
		});

		this.addSettingTab(new RedirectLinkSettingTab(this.app, this));
	}

	async onunload(): Promise<void> {
		// All registerEvent() calls are auto-cleaned by Obsidian.
		// Explicit onunload ensures the lifecycle contract is complete.
	}

	async copyRedirectLink(file: TFile): Promise<void> {
		if (!this.settings.vaultName || this.settings.vaultName.trim() === "") {
			new Notice("Set your vault name in Copy Redirect Link settings first.");
			return;
		}
		if (!this.settings.baseUrl || !isValidHttpUrl(this.settings.baseUrl)) {
			new Notice("Set a valid redirect server URL in Copy Redirect Link settings first.");
			return;
		}

		const url = buildRedirectUrl(this.settings, file.path);

		try {
			await navigator.clipboard.writeText(url);
			new Notice("Redirect link copied \u2713");
		} catch (e: unknown) {
			console.error("Clipboard write failed:", e);
			new Notice("Failed to copy link \u2014 check browser clipboard permissions.");
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

// ---------------------------------------------------------------------------
// Settings tab — UI only
// ---------------------------------------------------------------------------

class RedirectLinkSettingTab extends PluginSettingTab {
	plugin: RedirectLinkPlugin;
	private debouncedSave = debounce(async () => {
		await this.plugin.saveSettings();
	}, 500, true);

	constructor(app: App, plugin: RedirectLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Copy Redirect Link" });

		new Setting(containerEl)
			.setName("Redirect server URL")
			.setDesc("/v1/open is appended automatically if not present")
			.addText((text) =>
				text
					.setPlaceholder("https://link.example.com")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						this.debouncedSave();
					})
			);

		new Setting(containerEl)
			.setName("Vault name")
			.setDesc("Must match exactly what appears in Obsidian's vault switcher")
			.addText((text) =>
				text
					.setPlaceholder("MyVault")
					.setValue(this.plugin.settings.vaultName)
					.onChange(async (value) => {
						this.plugin.settings.vaultName = value;
						this.debouncedSave();
					})
			);

		const testSetting = new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Verify the redirect server is reachable");

		testSetting.addButton((button) =>
			button.setButtonText("Test").onClick(async () => {
				const baseUrl = this.plugin.settings.baseUrl;

				if (!baseUrl || !isValidHttpUrl(baseUrl)) {
					testSetting.setDesc("\u2717 Enter a valid URL first");
					return;
				}

				button.setDisabled(true);
				button.setButtonText("Testing...");

				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 5000);

				try {
					const testUrl = normalizeBaseUrl(baseUrl) + "?vault=test&file=test";
					await fetch(testUrl, { signal: controller.signal });
					testSetting.setDesc("\u2713 Server reachable");
				} catch (e: unknown) {
					if (e instanceof DOMException && e.name === "AbortError") {
						testSetting.setDesc("\u2717 Timed out \u2014 server may be down or URL incorrect");
					} else {
						testSetting.setDesc("\u2717 Unreachable \u2014 check URL and Cloudflare tunnel status");
					}
				} finally {
					clearTimeout(timeout);
					button.setDisabled(false);
					button.setButtonText("Test");
				}
			})
		);
	}
}
