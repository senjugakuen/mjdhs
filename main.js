'use strict'
const fs = require('fs')
const dhs = require('./dhs')
const db = {cids:[]}
const saveDb = ()=>{
    fs.writeFileSync('./db', JSON.stringify(db))
}
if (fs.existsSync('./db')) {
    db = JSON.parse(fs.readFileSync('./db'))
}
setInterval(saveDb, 300000)
process.on('exit', saveDb)
dhs.start('13564803353@qq.com', '552233', '70424026')

const callApi = async(method, cid, param)=>{
    return new Promise((resolve, reject)=>{
        if (typeof param !== undefined)
        param = [param]
        dhs.callApi(method, cid, resolve, param)
    })
}

const main = async(data, cmd, param, cid)=>{
    let uid = data.user_id
    let gid = data.group_id
    if (!db[gid]) db[gid] = {}
    let isAdmin = ['owner', 'admin'].includes(data.sender.role)
    let hasCid = db[gid].cid > 0
    if (hasCid) cid = db[gid].cid
    let result = ''
    if (cmd === '')
        result += 'help'
    else if (!hasCid && cmd !== '绑定')
        result += '请先绑定比赛'
    else {
        switch (cmd) {
            case '绑定':
                let res = await callApi('fetchContestInfo', cid)
                break
            default:
                break
        }
    }
    return result
}

module.exports = main
