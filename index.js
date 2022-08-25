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
		modList.push("lobomfz", channelName);
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
	chatClient.getMods(channelName).then((response) => {
		modList = response;
		modList.push("lobomfz", channelName);
	});
	console.log("Connected to Twitch!");
});

setInterval(updateMods, 60 * 1000);

chatClient.onMessage(async (channel, user, message, msg) => {
	var mSplit = message.toLowerCase().split(" ");
	if (modList.includes(user)) {
		switch (mSplit[0]) {
			case "test":
				console.log("teste");
				break;
			case "startbfbb":
				if (user == "lobomfz" || user == channelName)
					exec(`aws ec2 start-instances --instance-ids ${instanceId}`, () => {
						chatClient.say(channelName, "Starting TwitchPlays - bfbb");
					});
				else chatClient.say(channelName, "no");
				break;
			case "stopbfbb":
				if (user == "lobomfz" || user == channelName)
					exec(`aws ec2 stop-instances --instance-ids ${instanceId}`, () => {
						chatClient.say(channelName, "Stopping TwitchPlays - bfbb");
					});
				else chatClient.say(channelName, "no");
				break;
		}
	}
});
