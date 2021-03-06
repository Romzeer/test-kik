/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 
'use strict';

const apiai = require('apiai');
const Bot  = require('@kikinteractive/kik');
const uuid = require('node-uuid');
const request = require('request');
const http = require('http');
const axios = require('axios');

const REST_PORT = (process.env.PORT || 5000);
const APIAI_ACCESS_TOKEN = "dab09ae93f0d4d72bf253ef3792798f8";
const APIAI_LANG = process.env.APIAI_LANG || 'en';
const KIK_API_KEY = "7fa46f78-bb67-4f5f-8a5d-70f485a218c1";
const SERVICE_URL = "https://" + process.env.APP_NAME + ".herokuapp.com";

const apiAiService = apiai(APIAI_ACCESS_TOKEN, {language: APIAI_LANG, requestSource: "kik"});
const sessionIds = new Map();

let bot = new Bot({
    username: 'romano.bot',
    apiKey: KIK_API_KEY,
    baseUrl: SERVICE_URL
});

function isDefined(obj) {
    if (typeof obj == 'undefined') {
        return false;
    }

    if (!obj) {
        return false;
    }

    return obj != null;
}

bot.updateBotConfiguration();

bot.onStartChattingMessage((message) => {
    bot.getUserProfile(message.from)
        .then((user) => {
            console.log(user);
            message.reply(`Hey ${user.firstName}!`);
        });
});

bot.onTextMessage((message) => {
    // message format from https://dev.kik.com/#/docs/messaging#receiving-messages
    bot.getUserProfile(message.from)
    .then((user) => {
        console.log(user);
    });
    

    let chatId = message.chatId;
    let messageText = message.body;
    
    if (messageText) {
        if (!sessionIds.has(chatId)) {
            sessionIds.set(chatId, uuid.v1());
        }

        let apiaiRequest = apiAiService.textRequest(messageText,
            {
               sessionId: sessionIds.get(chatId)
            });

        apiaiRequest.on('response', (response) => {
            if (isDefined(response.result)) {
                let responseText = response.result.fulfillment.speech;
                let responseData = response.result.fulfillment.data;
                let action = response.result.action;
                console.log("chatId " + message.chatId);
                console.log("from " + message.from);
                console.log("requete: " + messageText);
                console.log("data : " + responseData);
                console.log("text : " + responseText);
                console.log("action : " + action);
                console.log(response);
                console.log(message);
                axios.post('https://api-jenyai.herokuapp.com/bot/data/create', {
                    data: response.result,
                    userId: chatId
                })
                    .then(function (response) {
                      
                        console.log(response);
                    })
                    .catch(function (error) {console.log(error.response);});
                
              

                if (isDefined(responseData) && isDefined(responseData.kik)) {
                    try {
                        // message can be formatted according to https://dev.kik.com/#/docs/messaging#message-formats
                        console.log('Response as formatted message');
                        message.reply(responseData.kik);
                    } catch (err) {
                        message.reply(err.message);
                    }
                } else if (isDefined(responseText)) {
                    console.log('Response as text message');
                    message.reply(responseText);
                }
            }
        });

        apiaiRequest.on('error', (error) => console.error(error));
        apiaiRequest.end();
    }
});

const server = http
    .createServer(bot.incoming())
    .listen(REST_PORT);