'use strict'
const { onmessage, start, stop, bots } = require('./main')

start()

async function listener(data) {
    const reply = await onmessage(data)
    if (reply)
        data.reply(reply)
}

function activate(bot) {
    bots.add(bot)
    bot.on("message", listener)
}

function deactivate(bot) {
    bots.delete(bot)
    bot.off("message", listener)
}

function destructor() {
    return stop()
}

module.exports = {
    activate, deactivate, destructor
}
