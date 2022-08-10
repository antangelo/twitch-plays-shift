import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { promises as fs } from 'fs';
import robot from 'robotjs';
import { exec } from 'child_process';

var isActive = 1;
var clientId, clientSecret, modList, channelName;

const tokenData = JSON.parse(await fs.readFile('./tokens.json', 'UTF-8'));
const authProvider = new RefreshingAuthProvider(
	{
		clientId,
		clientSecret,
		onRefresh: async (newTokenData) =>
			await fs.writeFile(
				'./tokens.json',
				JSON.stringify(newTokenData, null, 4),
				'UTF-8'
			),
	},
	tokenData
);

function readSettings() {
	try {
		jsonFile = fs.readFileSync('./settings.json').toString();
	} catch (e) {
		console.log('Could not load json file!');
		process.exit();
	}
	try {
		var parse = JSON.parse(jsonFile);
		clientId = parse['client-id'];
		clientSecret = parse['client-secret'];
		channelName = parse['channel-name'];
	} catch (e) {
		console.log(e, jsonFile);
		console.log('Failed to parse json');
		process.exit();
	}
}

const chatClient = new ChatClient({
	authProvider,
	channels: channelName,
});

const directions = {
	forward: '8',
	up: '8',
	back: '5',
	down: '5',
	left: '4',
	right: '6',
};
const keys = ['a', 'b', 'r', 'y', 'x', 'l', 'z'];

const simpleActions = [
	'move',
	'sneak',
	'press',
	'hold',
	'look',
	'turn',
	'jump',
	'roll',
];

const actionsModifiers = ['long', 'giga', 'light'];

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
	if (dir1) robot.keyToggle(directions[dir1], 'down');
	if (dir2) robot.keyToggle(directions[dir2], 'down');
	await sleep(time);
	if (dir1) robot.keyToggle(directions[dir1], 'up');
	if (dir2) robot.keyToggle(directions[dir2], 'up');
	return 1;
}

async function roll(dir1, dir2, time = 2000) {
	if (dir1) robot.keyToggle(directions[dir1], 'down');
	if (dir2) robot.keyToggle(directions[dir2], 'down');
	robot.keyToggle('r', 'down');
	await sleep(time);
	if (dir1) robot.keyToggle(directions[dir1], 'up');
	if (dir2) robot.keyToggle(directions[dir2], 'up');
	robot.keyToggle('r', 'up');
	return 1;
}

async function sneak(dir1, dir2, time = 600) {
	if (dir1) robot.keyToggle(directions[dir1], 'down', 'shift');
	if (dir2) robot.keyToggle(directions[dir2], 'down', 'shift');
	await sleep(time);
	if (dir1) robot.keyToggle(directions[dir1], 'up', 'shift');
	if (dir2) robot.keyToggle(directions[dir2], 'up', 'shift');
	return 1;
}

async function look(dir, time = 500) {
	switch (dir) {
		case 'left':
			robot.keyToggle('right', 'down');
			await sleep(time);
			robot.keyToggle('right', 'up');
			return 1;
		case 'right':
			robot.keyToggle('left', 'down');
			await sleep(time);
			robot.keyToggle('left', 'up');
			return 1;
	}
}
async function jump(dir1, dir2, long, time = 900) {
	robot.keyTap('a');
	if (dir1) robot.keyToggle(directions[dir1], 'down');
	if (dir2) robot.keyToggle(directions[dir2], 'down');
	if (long) robot.keyToggle('a', 'down');
	await sleep(time);
	if (long) robot.keyToggle('a', 'up');
	if (dir1) robot.keyToggle(directions[dir1], 'up');
	if (dir2) robot.keyToggle(directions[dir2], 'up');
}

async function press(key) {
	if (key) robot.keyTap(key);
	return 1;
}

async function hold(key, time = 2000) {
	console.log('holding ' + key);
	robot.keyToggle(key, 'down');
	await sleep(time);
	robot.keyToggle(key, 'up');
}

readSettings();

chatClient.connect();

chatClient.onRegister(() => {
	chatClient.getMods(channelName).then((response) => {
		modList = response;
	});
});

setInterval(updateMods, 5 * 60 * 1000);

chatClient.onMessage(async (channel, user, message, msg) => {
	robot.mouseClick();
	if (modList.includes(user) || user == channelName) {
		switch (message.toLowerCase()) {
			case 'stopbob':
				robot.keyTap('f1', 'shift');
				isActive = 0;
				robot.keyTap('f10');
				return 0;
			case 'startbob':
				isActive = 1;
				robot.keyTap('f10');
				robot.keyTap('f1');
				return 0;
			case 'savebob':
				robot.keyTap('f1', 'shift');
				return 0;
			case 'loadbob':
				robot.keyTap('f1');
				return 0;
			case 'savebob2':
				robot.keyTap('f2', 'shift');
				return 0;
			case 'loadbob2':
				robot.keyTap('f2');
				return 0;
			case 'rebootbob':
				exec('/home/user/archive/reboot.sh', (error, stdout, stderr) => {
					console.log(stdout);
				});
				await sleep(5000);
				robot.mouseClick();
				robot.keyTap('f2');
				return 0;
		}
	}

	if (isActive == 1) {
		console.log(message);
		var word1 = message.split(' ')[0]?.toLowerCase() || '';
		var word2 = message.split(' ')[1]?.toLowerCase() || '';
		var word3 = message.split(' ')[2]?.toLowerCase() || '';
		var word4 = message.split(' ')[3]?.toLowerCase() || '';

		// move directly
		if (word1 in directions) {
			word2 in directions ? move(word1, word2) : move(word1);
		}

		// press directly
		if (keys.includes(word1)) {
			press(word1);
		}

		// execute simple action
		if (simpleActions.includes(word1)) {
			switch (word1) {
				case 'move':
					if (word2 in directions)
						word3 in directions ? move(word2, word3) : move(word2);
					break;
				case 'sneak':
					if (word2 in directions)
						word3 in directions ? sneak(word2, word3) : sneak(word2);
					break;
				case 'press':
					if (keys.includes(word2)) press(word2);
					break;
				case 'turn':
				case 'look':
					if (word2 in directions) look(word2);
					break;
				case 'jump':
					if (word2 in directions)
						word3 in directions ? jump(word2, word3) : jump(word2);
					else jump();
					if (word2 == 'slam') press('x');
					break;
				case 'hold':
					if (keys.includes(word2)) hold(word2);
					break;
				case 'roll':
					if (word2 in directions)
						word3 in directions ? roll(word2, word3) : roll(word2);
					break;
			}
		}

		// execute action with modifiers jump(dir1, dir2, long, time = 900)
		if (actionsModifiers.includes(word1)) {
			switch (word2) {
				case 'turn':
				case 'look':
					if (word1 == 'light' && word3 in directions) look(word3, 200);
					break;
				case 'jump':
					var time;
					word1 == 'long' ? (time = 1500) : (time = 3000);
					if (word3 in directions)
						word4 in directions
							? jump(word3, word4, true, time)
							: jump(word3, null, true, time);
					else jump(null, null, true, time);
					break;
				case 'move':
					var time;
					word1 == 'long' ? (time = 1500) : (time = 3000);
					if (word3 in directions)
						word4 in directions
							? move(word3, word4, time)
							: move(word3, null, time);
					break;
				case 'roll':
					var time;
					word1 == 'long' ? (time = 3000) : (time = 5000);
					if (word3 in directions)
						word4 in directions
							? roll(word3, word4, time)
							: roll(word3, null, time);
					break;
			}
		}
	}
});
