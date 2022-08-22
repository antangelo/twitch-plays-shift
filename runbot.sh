#!/bin/bash
cd ~/twitch-plays
git pull
while true; do
node index.js &>> bot.log
done
