'use strict'
const fs = require('fs')
const url = require("url")
const proc = require('child_process')
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
        let r = url.parse(req.url)
        if (r.pathname === "/youShouldPull") {
            proc.exec('./up', (error, stdout, stderr) => {
                let output = JSON.stringify({
                    "stdout": stdout,
                    "stderr": stderr,
                    "error": error
                })
                res.end(output)
            })
        } else {
            res.writeHead(404)
            res.end()
        }
        return
    }
    if (req.method !== 'POST' || req.socket.remoteAddress !== '::ffff:172.17.0.2') {
        res.writeHead(404)
        res.end()
        return
    }
    let data = []
    req.on('data', (d)=>data.push(d))
    req.on('end', async()=>{
        try {
            data = Buffer.concat(data).toString()
            data = JSON.parse(data)
            if (data.post_type === 'message') {
                let result = await main(data)
                if (result) {
                    res.end(JSON.stringify({'reply': typeof result === 'string' ? result : JSON.stringify(result)}))
                    return
                }
            }
        } catch (e) {}
        res.writeHead(404)
        res.end()
    })
}).listen(3001)
