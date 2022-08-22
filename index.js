import { RefreshingAuthProvider } from "@twurple/auth";
import { promises, readFileSync } from "fs";
import { ChatClient } from "@twurple/chat";
import { exec } from "child_process";

var modList, clientId, clientSecret, channelName, instanceId;

const tokenData = JSON.parse(await promises.readFile("./tokens.json", "UTF-8"));

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
		instanceId = parse["instance-id"];
	} catch (e) {
		console.log("Failed to parse json");
		process.exit();
	}
}

function updateMods() {
	chatClient.getMods(channelName).then((response) => {
		modList = response;
	});
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
	console.log("Connected to Twitch!");
	chatClient.getMods(channelName).then((response) => {
		modList = response;
		console.log(modList);
	});
});

setInterval(updateMods, 60 * 1000); // Every minute instead?

chatClient.onMessage(async (channel, user, message, msg) => {
	var mSplit = message.toLowerCase().split(" ");

	if (modList.includes(user) || user == channelName) {
		switch (mSplit[0]) {
			case "startbfbb":
				exec(`aws ec2 start-instances --instance-ids ${instanceId}`, () => {
					chatClient.say(channelName, "Starting TwitchPlays - bfbb");
				});
				break;
			case "stopbfbb":
				exec(`aws ec2 stop-instances --instance-ids${instanceId}`, () => {
					chatClient.say(channelName, "Stopping TwitchPlays - bfbb");
				});
				break;
		}
	}
});
