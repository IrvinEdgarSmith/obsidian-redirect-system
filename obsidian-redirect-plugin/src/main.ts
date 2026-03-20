import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";

// ---------------------------------------------------------------------------
// Settings — data contract
// ---------------------------------------------------------------------------

interface PluginSettings {
	baseUrl: string;
	vaultName: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	baseUrl: "https://ObsidianLink.MycelialHost.net/v1/open",
	vaultName: "",
};

// ---------------------------------------------------------------------------
// Pure utility functions — no side effects, easily testable
// ---------------------------------------------------------------------------

function normalizeBaseUrl(input: string): string {
	let url = input.trim().replace(/\/+$/, "");
	if (!url.endsWith("/open")) {
		url = url.replace(/\/+$/, "") + "/v1/open";
	}
	return url;
}

function buildRedirectUrl(settings: PluginSettings, filePath: string): string {
	const base = normalizeBaseUrl(settings.baseUrl);
	return `${base}?vault=${encodeURIComponent(settings.vaultName)}&file=${encodeURIComponent(filePath)}`;
}

// ---------------------------------------------------------------------------
// Plugin — lifecycle + registration only
// ---------------------------------------------------------------------------

export default class RedirectLinkPlugin extends Plugin {
	settings: PluginSettings = DEFAULT_SETTINGS;

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

	async copyRedirectLink(file: TFile): Promise<void> {
		if (!this.settings.vaultName) {
			new Notice("Set your vault name in Redirect Link settings first.");
			return;
		}
		const url = buildRedirectUrl(this.settings, file.path);
		try {
			await navigator.clipboard.writeText(url);
			new Notice("Redirect link copied \u2713");
		} catch {
			new Notice("Failed to copy link to clipboard.");
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

	constructor(app: App, plugin: RedirectLinkPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Redirect server URL")
			.setDesc("/v1/open is appended automatically if not present")
			.addText((text) =>
				text
					.setPlaceholder("https://ObsidianLink.MycelialHost.net")
					.setValue(this.plugin.settings.baseUrl)
					.onChange(async (value) => {
						this.plugin.settings.baseUrl = value;
						await this.plugin.saveSettings();
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
						await this.plugin.saveSettings();
					})
			);

		const testSetting = new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Verify the redirect server is reachable");

		testSetting.addButton((button) =>
			button.setButtonText("Test").onClick(async () => {
				button.setDisabled(true);
				button.setButtonText("Testing...");

				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 3000);

				try {
					const testUrl =
						normalizeBaseUrl(this.plugin.settings.baseUrl) +
						"?vault=test&file=test";
					await fetch(testUrl, {
						signal: controller.signal,
						mode: "no-cors",
					});
					testSetting.setDesc("\u2713 Server reachable");
				} catch {
					testSetting.setDesc(
						"\u2717 Unreachable \u2014 check URL and Cloudflare tunnel status"
					);
				} finally {
					clearTimeout(timeout);
					button.setDisabled(false);
					button.setButtonText("Test");
				}
			})
		);
	}
}
