import type Auto from "@auto-it/core";
import { SEMVER } from "@auto-it/core";
import { makeHooks } from "@auto-it/core/dist/utils/make-hooks";
import endent from "endent";
import WebexPlugin from "../src";

const sendMessage = jest.fn();

jest.mock("webex-node", () => ({
	init: () => ({
		messages: {
			create: sendMessage,
		},	
	}),
}));

const mockResponse = {
	data: { html_url: "https://foo.com" },
	// biome-ignore lint/suspicious/noExplicitAny: no type information
} as any;
// biome-ignore lint/suspicious/noExplicitAny: no type information
const mockGit = { options: { repo: "Test-Repo" } } as any;
// biome-ignore lint/suspicious/noExplicitAny: no type information
const mockLogger = {
	log: {
		info: jest.fn(),
		debug: jest.fn(),
		warn: jest.fn(),
		error: jest.fn(),
	},
} as any;

test("Webex Plugin should throw without proper tokens set", async () => {
	expect(() => new WebexPlugin()).toThrow();
});

describe("Webex Plugin", () => {
	beforeAll(() => {
		process.env.WEBEX_TOKEN = "test-token";
		process.env.WEBEX_ROOM_ID = "test-room-id";
	});

	beforeEach(() => {
		sendMessage.mockReset();
	});

	test("should not throw with env variables set", async () => {
		expect(() => new WebexPlugin()).not.toThrow();
	});

	test("should do nothing without a new version", async () => {
		const plugin = new WebexPlugin();
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);
		await hooks.afterRelease.promise({
			commits: [],
			releaseNotes: "",
			lastRelease: "1.0.0",
		});

		expect(sendMessage).not.toHaveBeenCalled();
	});

	test("should do nothing if the threshold isn't met", async () => {
		const plugin = new WebexPlugin();
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);
		await hooks.afterRelease.promise({
			newVersion: "1.0.1",
			commits: [],
			releaseNotes: "",
			lastRelease: "1.0.0",
			response: mockResponse,
		});

		expect(sendMessage).not.toHaveBeenCalled();
	});

	test("should post message if threshold met", async () => {
		const plugin = new WebexPlugin();
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);
		await hooks.afterRelease.promise({
			newVersion: "1.1.0",
			commits: [],
			releaseNotes: "",
			lastRelease: "1.0.0",
			response: mockResponse,
		});

		expect(sendMessage).toHaveBeenCalled();
	});

	test("should still work if version doesn't change", async () => {
		const plugin = new WebexPlugin();
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);
		await hooks.afterRelease.promise({
			newVersion: "1.0.0",
			commits: [],
			releaseNotes: "",
			lastRelease: "1.0.0",
			response: mockResponse,
		});

		expect(sendMessage).not.toHaveBeenCalled();
	});

	test("should be able to configure threshold", async () => {
		const plugin = new WebexPlugin({ threshold: SEMVER.major });
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);
		await hooks.afterRelease.promise({
			newVersion: "1.1.0",
			commits: [],
			releaseNotes: "",
			lastRelease: "1.0.0",
			response: mockResponse,
		});

		expect(sendMessage).not.toHaveBeenCalled();
	});

	test("should be able to configure message", async () => {
		const plugin = new WebexPlugin({
			message: endent`
        v%version of %package was released!

        %link
      `,
		});
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);
		await hooks.afterRelease.promise({
			newVersion: "1.1.0",
			commits: [],
			releaseNotes: "",
			lastRelease: "1.0.0",
			response: mockResponse,
		});

		expect(sendMessage.mock.calls[0][0].markdown).toMatchSnapshot();
	});

	test("should post correct message", async () => {
		const plugin = new WebexPlugin();
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);
		await hooks.afterRelease.promise({
			newVersion: "1.1.0",
			commits: [],
			releaseNotes: endent`
        #### 🐛  Bug Fix

        - fix jira PR titles without additional subject [#404](https://github.com/intuit/auto/pull/404) ([@hipstersmoothie](https://github.com/hipstersmoothie))

        #### 📝  Documentation

        - update docs for canary [#402](https://github.com/intuit/auto/pull/402) ([@hipstersmoothie](https://github.com/hipstersmoothie))

        #### Authors: 1

        - Andrew Lisowski ([@hipstersmoothie](https://github.com/hipstersmoothie))
      `,
			lastRelease: "1.0.0",
			response: mockResponse,
		});

		expect(sendMessage.mock.calls[0][0].markdown).toMatchSnapshot();
	});

	test("should handle long release notes", async () => {
		const plugin = new WebexPlugin();
		const hooks = makeHooks();

		plugin.apply({ hooks, git: mockGit, logger: mockLogger } as Auto);
		await hooks.afterRelease.promise({
			newVersion: "1.1.0",
			commits: [],
			releaseNotes: endent`
        #### 🐛  Bug Fix

        - fix jira PR titles without additional subject [#404](https://github.com/intuit/auto/pull/404) ([@hipstersmoothie](https://github.com/hipstersmoothie))
        - split off useless hash from version [#387](https://github.com/intuit/auto/pull/387) ([@hipstersmoothie](https://github.com/hipstersmoothie))

        #### 📝  Documentation

        - update docs for canary [#402](https://github.com/intuit/auto/pull/402) ([@hipstersmoothie](https://github.com/hipstersmoothie))

        #### 🔩 Dependency Updates

        - update deps for things greenkeeper failed on [#385](https://github.com/intuit/auto/pull/385) ([@hipstersmoothie](https://github.com/hipstersmoothie))

        #### Authors: 1

        - Andrew Lisowski ([@hipstersmoothie](https://github.com/hipstersmoothie))
      `,
			lastRelease: "1.0.0",
			response: mockResponse,
		});

		expect(sendMessage.mock.calls[0][0].markdown).toMatchSnapshot();
	});
});
