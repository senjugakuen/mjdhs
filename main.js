'use strict'
const fs = require('fs')
const dhs = require('./dhs')
let db = {cids: new Set()}
const saveDb = ()=>{
    db.cids = [...db.cids]
    fs.writeFileSync('./db', JSON.stringify(db))
    db.cids = new Set(db.cids)
}
if (fs.existsSync('./db')) {
    db = JSON.parse(fs.readFileSync('./db'))
    db.cids = new Set(db.cids)
}
setInterval(saveDb, 300000)
process.on('exit', saveDb)
const eid = 70424026
dhs.start('13564803353@qq.com', '552233')

const callApi = async(method, cid, param)=>{
    return new Promise((resolve, reject)=>{
        if (typeof param !== undefined)
        param = [param]
        dhs.callApi(method, cid, (data)=>{
            if (data.hasOwnProperty('error'))
                reject(data)
            else
                resolve(data)
        }, param)
    })
}

const help = ``

const main = async(data, cmd, param)=>{
    let gid = data.group_id
    if (!gid) return '暂时不支持私聊'
    if (!db[gid]) db[gid] = {}
    let isAdmin = ['owner', 'admin'].includes(data.sender.role)
    if (!isAdmin && ['添加', '删除', '重置', '开赛'].includes(cmd))
        return '你没有权限'
    let cid = 0
    let hasCid = db[gid].cid > 0
    if (hasCid)
        cid = db[gid].cid
    if (cmd === '')
        return 'help'
    else if (!hasCid && cmd !== '绑定')
        return '尚未绑定比赛'
    else {
        try {
            switch (cmd) {
                case '绑定':
                    if (hasCid)
                        return '已经绑定过比赛了，需要先解绑。'
                    let cid = parseInt(param)
                    if (db.cids.has(cid))
                        return '该比赛已经被绑定了。'
                    await callApi('fetchContestInfo', cid)
                    db.cids.add(cid)
                    db[gid].cid = cid
                    return "绑定成功。"
                    break
                case '解绑':
                    if (!db[gid].cid)
                        return '尚未绑定比赛。'
                    delete db[gid].cid
                    db.cids.delete(cid)
                    return "解绑成功。(为了安全请务必同时删除大会室后台的管理权限)"
                    break
                case '规则':
                    let res = callApi('fetchContestGameRule', cid)
                    return res
                    break
                case '公告':
                    let res = callApi('fetchContestNotice', cid)
                    return res
                    break
                case '名单':
                    let res = callApi('fetchContestPlayer', cid)
                    return res
                    break
                case '大厅':
                    let res = callApi('startManageGame', cid)
                    return res
                    break
                case '添加':
                    break
                case '删除':
                    break
                case '重置':
                    break
                case '开赛':
                    break
                default:
                    return help
                    break
            }
        } catch (e) {
            let error = e.error
            if (error.code === 9999)
                return '网络错误，请再试一次。如果在维护就别试了。'
            if (error.code === 9997)
                return '响应超时，可能已经执行成功。'
            if (error.message)
                return error.message
            return '执行失败。'
        }
    }
}

module.exports = main
