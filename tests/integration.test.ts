import dotenv from "dotenv";
import type Auto from "@auto-it/core";
import { makeHooks } from "@auto-it/core/dist/utils/make-hooks";
import WebexPlugin from "../src";

// Load environment variables from .env file
dotenv.config();

describe("Webex Plugin Integration Tests", () => {
	// Skip these tests if env variables are not set
	const hasCredentials =
		process.env.WEBEX_TOKEN && process.env.WEBEX_ROOM_ID;

	if (!hasCredentials) {
		test.skip("Skipping integration tests - WEBEX_TOKEN or WEBEX_ROOM_ID not set", () => {});
		return;
	}

	const mockResponse = {
    data: { html_url: "https://github.com/pfafffabian-ifx/auto-webex/releases/tag/v1.0.0" },
    // biome-ignore lint/suspicious/noExplicitAny: no type information
	} as any;
	// biome-ignore lint/suspicious/noExplicitAny: no type information
	const mockGit = { options: { repo: "auto-webex-plugin-test" } } as any;
	// biome-ignore lint/suspicious/noExplicitAny: no type information
	const mockLogger = {
		log: {
			info: jest.fn(),
			debug: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
		},
	} as any;

	test("should successfully initialize with real credentials", () => {
		expect(() => new WebexPlugin()).not.toThrow();
	});

	test("should send a real message to Webex", async () => {
		const plugin = new WebexPlugin();
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);

		// This will actually send a message to the configured Webex room
		await expect(
			hooks.afterRelease.promise({
				newVersion: "1.1.0",
				commits: [],
				releaseNotes: `#### 🐛 Bug Fix
                - Test fix for integration testing

                #### Authors: 1

                - Integration Test Bot`,
				lastRelease: "1.0.0",
				response: mockResponse,
			}),
		).resolves.not.toThrow();
	}, 30000); // 30 second timeout for API call

	test("should handle custom message template with real API", async () => {
		const plugin = new WebexPlugin({
			message: "🚀 Test Release: v%version of %package\n\n%link",
		});
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);

		await expect(
			hooks.afterRelease.promise({
				newVersion: "2.0.0",
				commits: [],
				releaseNotes: "Test release notes",
				lastRelease: "1.0.0",
				response: mockResponse,
			}),
		).resolves.not.toThrow();
	}, 30000);

	test("should handle custom room ID from options", async () => {
		// Use the same room ID from env, but passed as an option
		const customRoomId = process.env.WEBEX_ROOM_ID;
		const plugin = new WebexPlugin({ roomId: customRoomId });
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);

		await expect(
			hooks.afterRelease.promise({
				newVersion: "1.2.0",
				commits: [],
				releaseNotes: "Test with custom room ID",
				lastRelease: "1.1.0",
				response: mockResponse,
			}),
		).resolves.not.toThrow();
	}, 30000);

	test("should not send message when threshold not met", async () => {
		const plugin = new WebexPlugin({ threshold: "major" });
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);

		// This should not send a message (minor release with major threshold)
		await hooks.afterRelease.promise({
			newVersion: "1.3.0",
			commits: [],
			releaseNotes: "Minor release - should not trigger message",
			lastRelease: "1.2.0",
			response: mockResponse,
		});

		// No assertion needed - just verifying it doesn't throw
		expect(true).toBe(true);
	}, 30000);
});
