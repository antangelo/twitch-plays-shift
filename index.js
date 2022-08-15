import { RefreshingAuthProvider } from "@twurple/auth";
import { promises, readFileSync } from "fs";
import { ChatClient } from "@twurple/chat";
import robot from "robotjs";
import { exec } from "child_process";

var modList, clientId, clientSecret, channelName, time, toggledKeys;

var isActive = 1;
const tokenData = JSON.parse(await promises.readFile("./tokens.json", "UTF-8"));
var permissionsJson = JSON.parse(readFileSync("./permissions.json").toString());

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
	"roll",
];

const actionsModifiers = {
	light: 300,
	long: 1500,
	giga: 3000,
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

function releaseToggledKey(keyName){ // If for some reason the key is already in toggledKeys (held down), let go and remove.
	if (keys.includes(keyName)){
		if (toggledKeys.includes(keyName)){
			robot.keyToggle(keyName,"up");
			toggledKeys.splice(toggledKeys.indexOf(keyName),1);
		}
	}
}

async function move(dir1, dir2, time = 600) {
	if (dir1) robot.keyToggle(directions[dir1], "down");
	if (dir2) robot.keyToggle(directions[dir2], "down");
	await sleep(time);
	if (dir1) robot.keyToggle(directions[dir1], "up");
	if (dir2) robot.keyToggle(directions[dir2], "up");
	return 1;
}

async function roll(dir1, dir2, time = 2000) {
	if (dir1) robot.keyToggle(directions[dir1], "down");
	if (dir2) robot.keyToggle(directions[dir2], "down");
	releaseToggledKey("r");
	robot.keyToggle("r", "down");
	await sleep(time);
	if (dir1) robot.keyToggle(directions[dir1], "up");
	if (dir2) robot.keyToggle(directions[dir2], "up");
	robot.keyToggle("r", "up");
	return 1;
}

async function sneak(dir1, dir2, time = 600) {
	if (dir1) robot.keyToggle(directions[dir1], "down", "shift");
	if (dir2) robot.keyToggle(directions[dir2], "down", "shift");
	await sleep(time);
	if (dir1) robot.keyToggle(directions[dir1], "up", "shift");
	if (dir2) robot.keyToggle(directions[dir2], "up", "shift");
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

async function jump(dir1, dir2, long, time = 900) {
	releaseToggledKey("a");
	robot.keyTap("a");
	if (dir1) robot.keyToggle(directions[dir1], "down");
	if (dir2) robot.keyToggle(directions[dir2], "down");
	if (long) robot.keyToggle("a", "down");
	await sleep(time);
	if (long) robot.keyToggle("a", "up");
	if (dir1) robot.keyToggle(directions[dir1], "up");
	if (dir2) robot.keyToggle(directions[dir2], "up");
}

async function press(key) {
	if (key){
		releaseToggledKey(key);
		robot.keyTap(key);
	}
	return 1;
}

async function hold(key, time = 2000) {
	if (key in directions) key = directions[key];
	releaseToggledKey(key);
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

setInterval(updateMods, 60 * 1000); // Every minute instead?

chatClient.onMessage(async (channel, user, message, msg) => {
	robot.mouseClick();
	var mSplit = message.toLowerCase().split(" ");
	if (modList.includes(user) || user == channelName) {
		
		if (mSplit[0] == "addloader") {
			if (mSplit[1] != undefined && mSplit[1].match(usernameRegex) && (!permissionsJson.loaders.includes(mSplit[1]))) {
				permissionsJson.loaders.push(mSplit[1]);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(
					channelName,
					`TwitchPlays - Added ${mSplit[1]} to loaders!`
				);
			} else {
				chatClient.say(
					channelName,
					`TwitchPlays - Unable to add ${mSplit[1]} to loaders!`
				);
			}
			return 0;
		}

		if (mSplit[0] == "removeloader" || mSplit[0] == "delloader") {
			var remWhere = permissionsJson.loaders.indexOf(mSplit[1]);
			if (mSplit[1] != undefined && remWhere != -1) {
				permissionsJson.loaders.splice(remWhere,1);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(
					channelName,
					`TwitchPlays - Removed ${mSplit[1]} from loaders!`
				);
			} else {
				chatClient.say(
					channelName,
					`TwitchPlays - Unable to remove ${mSplit[1]} from loaders!`
				);
			}
			return 0;
		}

		if (mSplit[0] == "addsaver") {
			if (mSplit[1] != undefined && mSplit[1].match(usernameRegex) && (!permissionsJson.savers.includes(mSplit[1]))) {
				permissionsJson.savers.push(mSplit[1]);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(
					channelName,
					`TwitchPlays - Added ${mSplit[1]} to savers!`
				);
			} else {
				chatClient.say(
					channelName,
					`TwitchPlays - Unable to add ${mSplit[1]} to savers!`
				);
			}
			return 0;
		}

		if (mSplit[0] == "removesaver" || mSplit[0] == "delsaver") {
			var remWhere = permissionsJson.savers.indexOf(mSplit[1]);
			if (mSplit[1] != undefined && remWhere != -1) {
				permissionsJson.savers.splice(remWhere,1);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(
					channelName,
					`TwitchPlays - Removed ${mSplit[1]} from savers!`
				);
			} else {
				chatClient.say(
					channelName,
					`TwitchPlays - Unable to remove ${mSplit[1]} from savers!`
				);
			}
			return 0;
		}

		if (mSplit[0] == "blockinput" || mSplit[0] == "blockbob" || mSplit[0] == "addblocked") {
			if (mSplit[1] != undefined && mSplit[1].match(usernameRegex) && (!permissionsJson.blocked.includes(mSplit[1]))) {
				permissionsJson.blocked.push(mSplit[1]);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(
					channelName,
					`TwitchPlays - ${mSplit[1]} can no longer send inputs to the game!`
				);
			} else {
				chatClient.say(
					channelName,
					`TwitchPlays - Unable to block ${mSplit[1]}'s input!`
				);
			}
			return 0;
		}

		if (mSplit[0] == "unblockinput" || mSplit[0] == "unblockbob" || mSplit[0] == "removeblocked" || mSplit[0] == "delblocked") {
			var remWhere = permissionsJson.blocked.indexOf(mSplit[1]);
			if (mSplit[1] != undefined && remWhere != -1) {
				permissionsJson.blocked.splice(remWhere,1);
				await promises.writeFile(
					"./permissions.json",
					JSON.stringify(permissionsJson, null, 4),
					"UTF-8"
				);
				chatClient.say(
					channelName,
					`TwitchPlays - ${mSplit[1]} can send inputs to the game again!`
				);
			} else {
				chatClient.say(
					channelName,
					`TwitchPlays - Unable to remove ${mSplit[1]} from block list!`
				);
			}
			return 0;
		}

		switch (message.toLowerCase()) {
			case "stopbob":
				isActive = 0;
				robot.keyTap("f10");
				return 0;
			case "startbob":
				isActive = 1;
				robot.keyTap("f10");
				return 0;
			case "savebob":
				robot.keyTap("f1", "shift");
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
				chatClient.say(
					channelName,
					`TwitchPlays - Loaders: ${permissionsJson.loaders.join(", ") || "(None)"}`
				);
				return 0;
			case "clearloaders":
				permissionsJson.loaders = [];
				chatClient.say(channelName, `TwitchPlays - Cleared the loaders list!`);
				return 0;
			case "listsavers":
				chatClient.say(
					channelName,
					`TwitchPlays - Savers: ${permissionsJson.savers.join(", ") || "(None)"}`
				);
				return 0;
			case "clearsavers":
				permissionsJson.savers = [];
				chatClient.say(channelName, `TwitchPlays - Cleared the savers list!`);
				return 0;
			case "listblocked":
				chatClient.say(
					channelName,
					`TwitchPlays - Blocked: ${permissionsJson.blocked.join(", ") || "(None)"}`
				);
				return 0;
			case "clearblocked":
				permissionsJson.blocked = [];
				chatClient.say(channelName, `TwitchPlays - Cleared the blocked list!`);
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

	if (permissionsJson.blocked.includes(user)) {
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

		if (mSplit[0] == "toggle" && keys.includes(mSplit[1])){
			if (toggledKeys.includes(mSplit[1])){
				robot.keyToggle(mSplit[1],"up");
				toggledKeys.splice(toggledKeys.indexOf(mSplit[1]),1);
			} else{
				robot.keyToggle(mSplit[1],"down");
				toggledKeys.push(mSplit[1]);
			}
			return 0;
		}

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
					if (keys.includes(mSplit[1])) press(mSplit[1]);
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
			}
		}

		// execute action with modifiers jump(dir1, dir2, long, time = 900)
		if (mSplit[0] in actionsModifiers) {
			var dir1, dir2;
			time = actionsModifiers[mSplit[0]];
			dir1 = mSplit[2] in directions ? mSplit[2] : null;
			dir2 = mSplit[3] in directions ? mSplit[3] : null;
			switch (mSplit[1]) {
				case "turn":
				case "look":
					if (mSplit[0] == "light" && mSplit[2] in directions)
						look(mSplit[2], 200); // hard coded cause why not
					break;
				case "jump":
					jump(dir1, dir2, true, time);
					break;
				case "move":
					move(dir1, dir2, time);
					break;
				case "hold":
					if (keys.includes(mSplit[2]) || mSplit[2] in directions) {
						console.log("holding", mSplit[2], "for seconds ", time + 500);
						hold(mSplit[2], time + 500);
					}
					break;
			}
		}
	}
});
