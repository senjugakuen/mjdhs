'use strict'
const fs = require('fs')
process.on('uncaughtException', (e)=>{
    fs.appendFileSync('err.log', Date() + ' ' + e.stack + '\n')
    // process.exit(1)
})
process.on('unhandledRejection', (reason, promise)=>{
    fs.appendFileSync('err.log', Date() + ' Unhandled Rejection at:' + promise + 'reason:' + reason + '\n')
});

const main = require('./main')
const http = require('http')
http.createServer((req, res)=>{
    if (req.method === 'GET') {
        res.end()
        return
    }
    if (req.method !== 'POST' || !['127.0.0.1', '::1'].includes(req.socket.remoteAddress)) {
        res.end()
        return
    }
    let data = []
    req.on('data', (d)=>data.push(d))
    req.on('end', async()=>{
        try {
            data = Buffer.concat(data).toString()
            data = JSON.parse(data)
            if (data.post_type === 'message' && data.message.trim().substr(0, 3).toLowerCase() === 'dhs') {
                let result = await main(data, cmd, param)
                res.end(JSON.stringify({'reply': typeof result === 'string' ? result : JSON.stringify(result)}))
                return
            }
            res.end()
        } catch (e) {
            res.end()
        }
    })
}).listen(3001)
