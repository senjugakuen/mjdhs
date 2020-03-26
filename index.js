'use strict'
const fs = require('fs')
process.on('uncaughtException', (e)=>{
    fs.appendFile('err.log', Date() + ' ' + e.stack + '\n', ()=>{})
    process.exit(1)
})
process.on('unhandledRejection', (reason, promise)=>{
    fs.appendFileSync('err.log', Date() + ' Unhandled Rejection at:' + promise + 'reason:' + reason + '\n')
});

// const WebSocket = require('ws')

const main = require('./main')
// const wss = new WebSocket.Server({ port: 3000 })
// wss.on('connection', (ws)=>{
//     ws.on('message', async(message)=>{
//         let data = JSON.parse(message)
//         const reply = (msg)=>{
//             let res = {
//                 'action': '.handle_quick_operation',
//                 'params': {
//                     'context': data,
//                     'operation': {
//                         'reply': typeof msg === 'string' ? msg : JSON.stringify(msg)
//                     }
//                 }
//             }
//             ws.send(res)
//         }
//         if (data.post_type === 'message' && data.message.substr(0, 3).toLowerCase() === 'dhs') {
//             let parmas = data.message.substr(1).split(' ')
//             let cmd = parmas[0].substr(3)
//             let param = parmas[1]
//             if (data.user_id === 372914165) { //调试代码
//                 delete require.cache[require.resolve('./main.js')]
//                 let main = require('./main.js')
//                 let result = await main(data, cmd, param)
//                 reply(result)
//             }
//         }
//     })
// })

const http = require('http')
http.createServer((req, res)=>{

    let data = []
    req.on('data', (d)=>data.push(d))
    req.on('end', async()=>{
        try {
            data = Buffer.concat(gbl).toString()
            data = JSON.parse(data)
            if (data.post_type === 'message' && data.message.substr(0, 3).toLowerCase() === 'dhs') {
                let parmas = data.message.substr(1).split(' ')
                let cmd = parmas[0].substr(3)
                let param = parmas[1]
                if (data.user_id === 372914165) { //调试代码
                    // delete require.cache[require.resolve('./main.js')]
                    // let main = require('./main.js')
                    let result = await main(data, cmd, param)
                    res.end({'reply': result})
                    return
                }
            }
            res.end()
        } catch (e) {
            res.end()
        }
    })
}).listen(3001)
