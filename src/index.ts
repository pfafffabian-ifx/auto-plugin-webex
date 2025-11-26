import {
	type Auto,
	type IPlugin,
	SEMVER,
	validatePluginConfiguration,
} from "@auto-it/core";
import endent from "endent";
import * as t from "io-ts";
import { diff, type ReleaseType } from "semver";

const pluginOptions = t.partial({
	/** The message template to use to post to Webex */
	message: t.string,
	/** A threshold the semver has to pass to be posted to Webex */
	threshold: t.keyof({
		patch: null,
		minor: null,
		major: null,
	}),
	/** The Webex room ID to post messages to */
	roomId: t.string,
});

export type IWebexPluginOptions = t.TypeOf<typeof pluginOptions>;

const RELEASE_PRECEDENCE: ReleaseType[] = ["patch", "minor", "major"];

/** Determine the release with the biggest semver change */
const isGreaterThan = (a: ReleaseType, b: ReleaseType) =>
	RELEASE_PRECEDENCE.indexOf(a) > RELEASE_PRECEDENCE.indexOf(b);

interface MakeMessageArgs {
	/** The generated release notes for the release */
	releaseNotes: string;
	/** The message template to use to post to Webex */
	message: string;
	/** The semver bump applied to the version */
	versionBump: ReleaseType;
	/** The new version to release (already bumped) */
	newVersion: string;
	/** GitHub project to operate on */
	repo: string;
	/** A url to link to the release */
	url: string;
}

/** Construct a message that contains the release notes */
const makeMessage = ({
	releaseNotes,
	message,
	versionBump,
	newVersion,
	repo,
	url,
}: MakeMessageArgs) => {
	/** Replace all the variables in the message */
	const build = (notes: string) =>
		message
			.replace("%release", versionBump)
			.replace("%package", repo)
			.replace("%version", newVersion)
			.replace("%notes", notes)
			.replace("%link", url);

	const truncatedNotes = releaseNotes
		.split("#### Authors")[0]
		.replace(/#### /gm, "")
		.replace(/\(?\[\S+\]\(\S+\)/gm, "")
		.trim();

	return build(truncatedNotes);
};

/** Post your release notes to Webex Teams during `auto release` */
export default class WebexPlugin implements IPlugin {
	/** The name of the plugin */
	name = "auto-plugin-webex";

	/** The options of the plugin */
	readonly options: Required<IWebexPluginOptions>;

	/** The Webex access token */
	private readonly token: string;

	/** Initialize the plugin with it's options */
	constructor(options: Partial<IWebexPluginOptions> = {}) {
		// Set defaults with environment variables evaluated at construction time
		this.options = {
			threshold: options.threshold ?? SEMVER.minor,
			roomId: options.roomId ?? process.env.WEBEX_ROOM_ID ?? "",
			message: options.message ?? endent`
    A new %release version of %package was released!

    %notes

    %link
  `,
		};

		if (!process.env.WEBEX_TOKEN) {
			throw new Error(
				"Need WEBEX_TOKEN environment variable to post to Webex Teams",
			);
		}

		if (!this.options.roomId && !process.env.WEBEX_ROOM_ID) {
			throw new Error(
				"Need WEBEX_ROOM_ID environment variable or roomId option to post to Webex Teams",
			);
		}

		this.token = process.env.WEBEX_TOKEN;
	}

	/** Send a message to Webex Teams */
	private async sendMessage(auto: Auto, message: string): Promise<void> {
		auto.logger.log.info("Webex: Preparing to send message to room");
		
		const body = JSON.stringify({
			roomId: this.options.roomId,
			markdown: message,
		});

		const response = await fetch("https://webexapis.com/v1/messages", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.token}`,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			body,
		});

		if (!response.ok) {
			const errorText = await response.text();
			auto.logger.log.error("Webex: Failed to send message");
			throw new Error(
				`Failed to send Webex message: ${response.status} ${response.statusText} - ${errorText}`,
			);
		}
		
		auto.logger.log.info("Webex: Message sent successfully");
	}

	/** Tap into auto plugin points. */
	apply(auto: Auto) {
		auto.hooks.validateConfig.tapPromise(this.name, async (name, options) => {
			if (name === this.name) {
				auto.logger.log.info("Webex: Validating plugin configuration");
				return validatePluginConfiguration(this.name, pluginOptions, options);
			}
		});

		auto.hooks.afterRelease.tapPromise(
			this.name,
			async ({ newVersion, lastRelease, response, releaseNotes }) => {
				if (!newVersion || !response || !auto.git) {
					auto.logger.log.info("Webex: Skipping post-release notification (missing required data)");
					return;
				}

				const versionBump = diff(newVersion, lastRelease) || "patch";
				auto.logger.log.info(`Webex: Version bump detected: ${versionBump} (${lastRelease} -> ${newVersion})`);

				if (isGreaterThan(this.options.threshold as ReleaseType, versionBump)) {
					auto.logger.log.info(`Webex: Version bump ${versionBump} does not meet threshold ${this.options.threshold}`);
					return;
				}

				const url = Array.isArray(response)
					? response.map((r) => `- ${r.data.html_url}`).join("\n")
					: response.data.html_url;

				auto.logger.log.info("Webex: Creating release message");
				await this.sendMessage(
					auto,
					makeMessage({
						releaseNotes,
						message: this.options.message,
						versionBump,
						newVersion,
						repo: auto.git.options.repo,
						url,
					}),
				);
			},
		);
	}
}
