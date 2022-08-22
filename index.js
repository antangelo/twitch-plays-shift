import { RefreshingAuthProvider } from "@twurple/auth";
import { promises, readFileSync } from "fs";
import { ChatClient } from "@twurple/chat";
import robot from "robotjs";
import { exec } from "child_process";

var modList, clientId, clientSecret, channelName, time;

var isActive = 0;
const tokenData = JSON.parse(await promises.readFile("./tokens.json", "UTF-8"));
var permissionsJson = JSON.parse(readFileSync("./permissions.json").toString());

// If you're still using the old block list, migrate to new one.
permissionsJson.blocked = permissionsJson.blocked.map((x) => {
	if (typeof x != "object") {
		return { user: x, expires: -1 }; // By default, perma block oldies. -1 is NEVER expires.
	}
	return x;
});

async function removeExpiredBlocks() {
	var oldBlocked = JSON.stringify(permissionsJson.blocked);
	permissionsJson.blocked = permissionsJson.blocked.filter((x) => {
		return Date.now() < x.expires || x.expires == -1;
	});
	if (JSON.stringify(permissionsJson.blocked) != oldBlocked) {
		await promises.writeFile(
			"./permissions.json",
			JSON.stringify(permissionsJson, null, 4),
			"UTF-8"
		);
	}
}

setInterval(removeExpiredBlocks, 1000);

// https://discuss.dev.twitch.tv/t/twitch-channel-name-regex/3855/4
const usernameRegex = RegExp("^(#)?[a-zA-Z0-9][\\w]{2,24}$");

function readSettings() {
	try {
		var jsonFile = readFileSync("./settings.json").toString();
	} catch (e) {
		console.log("Could not load json file!");
		process.exit();
	}
	try {
		var parse = JSON.parse(jsonFile);
		clientId = parse["client-id"];
		clientSecret = parse["client-secret"];
		channelName = parse["channel-name"];
	} catch (e) {
		console.log("Failed to parse json");
		process.exit();
	}
}

const directions = {
	forward: "8",
	up: "8",
	back: "5",
	down: "5",
	left: "4",
	right: "6",
};

const keys = ["a", "b", "r", "y", "x", "l", "z"];

const simpleActions = [
	"move",
	"sneak",
	"press",
	"hold",
	"look",
	"turn",
	"jump",
	"keepdown",
	"bash",
	"bowl",
	"attack",
];

const actionsModifiers = {
	micro: 100,
	light: 300,
	double: 500,
	giga: 1200,
};

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function updateMods() {
	chatClient.getMods(channelName).then((response) => {
		modList = response;
	});
}

async function move(dir1, dir2, time = 600) {
	if (dir1) robot.keyToggle(directions[dir1], "down");
	if (dir2) robot.keyToggle(directions[dir2], "down");
	await sleep(time);
	if (dir1) robot.keyToggle(directions[dir1], "up");
	if (dir2) robot.keyToggle(directions[dir2], "up");
	return 1;
}

async function sneak(dir1, dir2, time = 600) {
	if (dir1) robot.keyToggle(directions[dir1], "down", "control");
	if (dir2) robot.keyToggle(directions[dir2], "down", "control");
	await sleep(time);
	if (dir1) robot.keyToggle(directions[dir1], "up", "control");
	if (dir2) robot.keyToggle(directions[dir2], "up", "control");
	return 1;
}

async function look(dir, time = 600) {
	switch (dir) {
		case "left":
			robot.keyToggle("right", "down");
			await sleep(time);
			robot.keyToggle("right", "up");
			return 1;
		case "right":
			robot.keyToggle("left", "down");
			await sleep(time);
			robot.keyToggle("left", "up");
			return 1;
	}
}

async function jump(dir1, dir2, double, time = 900) {
	robot.keyToggle("a", "down");
	if (dir1) robot.keyToggle(directions[dir1], "down");
	if (dir2) robot.keyToggle(directions[dir2], "down");
	if (double) {
		await sleep(200);
		robot.keyToggle("a", "up");
		await sleep(50);
		robot.keyToggle("a", "down");
		time > 1000 ? await sleep(500) : await sleep(100);
		robot.keyTap("b");
	}

	await sleep(time);
	if (double) robot.keyToggle("a", "up");
	if (dir1) robot.keyToggle(directions[dir1], "up");
	if (dir2) robot.keyToggle(directions[dir2], "up");
}

async function press(key) {
	if (key) robot.keyTap(key);
	return 1;
}

async function hold(key, time = 2000) {
	if (key in directions) key = directions[key];
	robot.keyToggle(key, "down");
	await sleep(time);
	robot.keyToggle(key, "up");
}

readSettings();

const authProvider = new RefreshingAuthProvider(
	{
		clientId,
		clientSecret,
		onRefresh: async (newTokenData) =>
			await promises.writeFile(
				"./tokens.json",
				JSON.stringify(newTokenData, null, 4),
				"UTF-8"
			),
	},
	tokenData
);

const chatClient = new ChatClient({
	authProvider,
	channels: [channelName],
});

chatClient.connect();

chatClient.onRegister(() => {
	chatClient.getMods(channelName).then((response) => {
		modList = response;
	});
});

// This function is to ensure absolutely everything is sent.
function sayFull(msg) {
	while (msg.length > 0) {
		chatClient.say(channelName, msg.slice(0, 400));
		msg = msg.slice(400);
	}
}

setInterval(updateMods, 60 * 1000); // Every minute instead?

chatClient.onMessage(async (channel, user, message, msgfull) => {
	robot.mouseClick();
	var mSplit = message.toLowerCase().split(" ");
	if (modList.includes(user) || user == channelName) {
		if (mSplit[0] == "addloader") {
			if (
				mSplit[1] != undefined &&
				mSplit[1].match(usernameRegex) &&
				!permissionsJson.loaders.includes(mSplit[1])
			) {
				permissionsJson.loaders.push(mSplit[1]);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(channelName, `Added ${mSplit[1]} to loaders!`);
			} else {
				chatClient.say(channelName, `Unable to add ${mSplit[1]} to loaders!`);
			}
			return 0;
		}

		if (mSplit[0] == "removeloader" || mSplit[0] == "delloader") {
			var remWhere = permissionsJson.loaders.indexOf(mSplit[1]);
			if (mSplit[1] != undefined && remWhere != -1) {
				permissionsJson.loaders.splice(remWhere, 1);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(channelName, `Removed ${mSplit[1]} from loaders!`);
			} else {
				chatClient.say(
					channelName,
					`Unable to remove ${mSplit[1]} from loaders!`
				);
			}
			return 0;
		}

		if (mSplit[0] == "addsaver") {
			if (
				mSplit[1] != undefined &&
				mSplit[1].match(usernameRegex) &&
				!permissionsJson.savers.includes(mSplit[1])
			) {
				permissionsJson.savers.push(mSplit[1]);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(channelName, `Added ${mSplit[1]} to savers!`);
			} else {
				chatClient.say(channelName, `Unable to add ${mSplit[1]} to savers!`);
			}
			return 0;
		}

		if (mSplit[0] == "removesaver" || mSplit[0] == "delsaver") {
			var remWhere = permissionsJson.savers.indexOf(mSplit[1]);
			if (mSplit[1] != undefined && remWhere != -1) {
				permissionsJson.savers.splice(remWhere, 1);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(channelName, `Removed ${mSplit[1]} from savers!`);
			} else {
				chatClient.say(
					channelName,
					`Unable to remove ${mSplit[1]} from savers!`
				);
			}
			return 0;
		}

		if (
			mSplit[0] == "blockinput" ||
			mSplit[0] == "blockbob" ||
			mSplit[0] == "addblocked"
		) {
			if (
				mSplit[1] != undefined &&
				mSplit[1].match(usernameRegex) &&
				!permissionsJson.blocked.map((x) => x.user).includes(mSplit[1])
			) {
				var blockLength = parseInt(mSplit[2], 10);
				blockLength = Number.isFinite(blockLength) ? blockLength : -1; // If no number or an invalid one is given, assume forever.
				permissionsJson.blocked.push({
					user: mSplit[1],
					expires: blockLength != -1 ? Date.now() + blockLength * 1000 : -1,
				});
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(
					channelName,
					`${mSplit[1]} can no longer send inputs to the game for${
						blockLength == -1 ? "ever" : " " + blockLength + " seconds"
					}!`
				);
			} else {
				chatClient.say(channelName, `Unable to block ${mSplit[1]}'s input!`);
			}
			return 0;
		}

		if (
			mSplit[0] == "unblockinput" ||
			mSplit[0] == "unblockbob" ||
			mSplit[0] == "removeblocked" ||
			mSplit[0] == "delblocked"
		) {
			var remWhere = permissionsJson.blocked
				.map((x) => x.user)
				.indexOf(mSplit[1]);
			if (mSplit[1] != undefined && remWhere != -1) {
				permissionsJson.blocked.splice(remWhere, 1);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(
					channelName,
					`${mSplit[1]} can send inputs to the game again!`
				);
			} else {
				chatClient.say(
					channelName,
					`Unable to remove ${mSplit[1]} from block list!`
				);
			}
			return 0;
		}

		switch (message.toLowerCase()) {
			case "savebob":
				robot.keyTap("f1", "shift");
				return 0;
			case "pausebfbb":
				robot.keyTap("f10");
				isActive = 0;
				return 0;
			case "resumebfbb":
				robot.keyTap("f10");
				isActive = 1;
				return 0;
			case "loadbob":
				robot.keyTap("f1");
				return 0;
			case "savebob2":
				robot.keyTap("f2", "shift");
				return 0;
			case "loadbob2":
				robot.keyTap("f2");
				return 0;
			case "listloaders":
				sayFull(`Loaders: ${permissionsJson.loaders.join(", ") || "(None)"}`);
				return 0;
			case "clearloaders":
				permissionsJson.loaders = [];
				chatClient.say(channelName, `Cleared the loaders list!`);
				return 0;
			case "listsavers":
				sayFull(`Savers: ${permissionsJson.savers.join(", ") || "(None)"}`);
				return 0;
			case "clearsavers":
				permissionsJson.savers = [];
				chatClient.say(channelName, `Cleared the savers list!`);
				return 0;
			case "listblocked":
				sayFull(
					`Blocked: ${
						permissionsJson.blocked
							.map((x) => {
								return `${x.user} is blocked for${
									x.expires == -1
										? "ever"
										: " " +
										  ((x.expires - Date.now()) / 1000).toFixed() +
										  " seconds"
								}`;
							})
							.join(", ") || "(None)"
					}`
				);
				return 0;
			case "clearblocked":
				permissionsJson.blocked = [];
				chatClient.say(channelName, `Cleared the blocked list!`);
				return 0;
			case "rebootbob":
				exec("/home/user/archive/reboot.sh", (error, stdout, stderr) => {
					console.log(stdout);
				});
				await sleep(5000);
				robot.mouseClick();
				robot.keyTap("f2");
				return 0;
		}
	}

	if (permissionsJson.blocked.map((x) => x.user).includes(user)) {
		return 0; // You have no power here >:^)
	}

	if (permissionsJson.loaders.includes(user)) {
		switch (message.toLowerCase()) {
			case "loadbob":
				robot.keyTap("f1");
				return 0;
			case "loadbob2":
				robot.keyTap("f2");
				return 0;
		}
	}

	if (permissionsJson.savers.includes(user)) {
		switch (message.toLowerCase()) {
			case "start":
				robot.keyTap("enter");
				return 0;
			case "press start":
				robot.keyTap("enter");
				return 0;
			case "savebob":
				robot.keyTap("f1", "shift");
				return 0;
			case "savebob2":
				robot.keyTap("f2", "shift");
				return 0;
		}
	}

	if (isActive == 1) {
		console.log(message);

		// move directly
		if (mSplit[0] in directions) {
			move(mSplit[0], mSplit[1] in directions ? mSplit[1] : null);
		}

		// press directly
		if (keys.includes(mSplit[0])) {
			press(mSplit[0]);
		}

		// execute simple action
		if (simpleActions.includes(mSplit[0])) {
			switch (mSplit[0]) {
				case "move":
					if (mSplit[1] in directions)
						move(mSplit[1], mSplit[2] in directions ? mSplit[2] : null);
					break;
				case "sneak":
					if (mSplit[1] in directions)
						sneak(mSplit[1], mSplit[2] in directions ? mSplit[2] : null);
					break;
				case "press":
					if (keys.includes(mSplit[1])) press(mSplit[0]);
					break;
				case "turn":
				case "look":
					if (mSplit[1] in directions) look(mSplit[1]);
					break;
				case "jump":
					if (mSplit[1] in directions)
						jump(mSplit[1], mSplit[2] in directions ? mSplit[2] : null);
					else jump();
					if (mSplit[1] == "slam") press("x");
					break;
				case "hold":
					if (keys.includes(mSplit[1]) || mSplit[1] in directions)
						hold(mSplit[1]);
					break;
				case "roll":
					if (mSplit[1] in directions)
						roll(mSplit[1], mSplit[2] in directions ? mSplit[2] : null);
					break;
				case "keepdown":
					if (mSplit[1] == "r" || mSplit[1] == "l") {
						return 0;
					}
					if (keys.includes(mSplit[1])) robot.keyToggle(mSplit[1], "down");
					break;
				case "bash":
					press("y");
					break;
				case "bowl":
					press("x");
					break;
				case "attack":
					press("b");
					break;
			}
		}

		// execute action with modifiers jump(dir1, dir2, double, time = 900)
		if (mSplit[0] in actionsModifiers) {
			var dir1, dir2;
			time = actionsModifiers[mSplit[0]];
			dir1 = mSplit[2] in directions ? mSplit[2] : null;
			dir2 = mSplit[3] in directions ? mSplit[3] : null;
			switch (mSplit[1]) {
				case "turn":
				case "look":
					if (mSplit[2] in directions) {
						if (mSplit[0] == "light") look(mSplit[2], 200);
						else if (mSplit[0] == "micro") look(mSplit[2], 50);
					}
					break;
				case "jump":
					jump(dir1, dir2, true, time);
					break;
				case "move":
					move(dir1, dir2, time);
					break;
				case "hold":
					if (keys.includes(mSplit[2]) || mSplit[2] in directions)
						hold(mSplit[2], time + 500);
					break;
			}
		}
	}
});
