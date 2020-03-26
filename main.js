'use strict'
const fs = require('fs')
const moment = require('moment')
const dhs = require('./dhs')
const isMaster = (id)=>{
    return [372914165].includes(id)
}

// 加载db
let db = {cids: new Set()}
if (fs.existsSync('./db')) {
    db = JSON.parse(fs.readFileSync('./db'))
    db.cids = new Set(db.cids)
}

// 定时保存db
const saveDbSync = ()=>{
    db.cids = [...db.cids]
    fs.writeFileSync('./db', JSON.stringify(db))
    db.cids = new Set(db.cids)
}
setInterval(saveDbSync, 300000)
process.on('exit', saveDbSync)

// 启动
const eid = 25331349 //70424026
dhs.start('372914165@qq.com', '552233', eid)

const reboot = ()=>{
    new Promise((resolve, reject)=>{
        dhs.close(()=>resolve())
    }).then(()=>process.exit(1))
}

const callApi = async(method, cid, param)=>{
    return new Promise((resolve, reject)=>{
        dhs.callApi(method, cid, (data)=>{
            if (data.hasOwnProperty('error'))
                reject(data)
            else
                resolve(data)
        }, [param])
    })
}

const help = `-----dhs指令说明-----
第①步 在大会室后台将 ${eid}(查询) 设置为比赛管理
第②步 使用"dhs绑定 赛事id"指令将qq群和比赛绑定(赛事id是6位数字)
第③步 就可以用下面的指令啦
dhs情报 ※查看赛事基本信息和规则
dhs名单 ※查看选手名单 (别名: dhs选手)
dhs公告 ※查看公告
dhs大厅 ※查看大厅中的对局，和准备中的玩家
★下面的命令群管理员才能使用
dhs添加 id1,id2,id3 ※添加选手 (不能使用昵称，下同)
dhs删除 id1,id2,id3 ※删除选手
dhs重置 id1,id2,id3 ※只保留指定选手
dhs开赛 昵称1,昵称2,昵称3,昵称4 ※少设置选手会自动添加电脑
dhs绑定 赛事id
dhs解绑
★其他命令
dhs刷新 ※赛事基本信息更新不及时的时候，可使用此命令`

const u = (res)=>{
    let failure = res.total - res.success
    return `总数${res.total}个，成功${res.success}个。` + (failure ? failure + '个ID是空号。' : '')
}

const main = async(data)=>{
    data.message = data.message.trim()
    let debug = false
    if (data.message[0] === '-') {
        debug = true
        data.message = data.message.substr(1)
    }
    if (data.message.substr(0, 3).toLowerCase() !== 'dhs')
        return
    let parmas = data.message.trim().split(' ')
    let cmd = parmas.shift().substr(3).trim()
    if (isMaster(data.user_id) && cmd === '重启') {
        reboot()
        return '好的'
    }
    let param = parmas.join("").replace(/，/g, ',')
    let gid = data.group_id
    if (!gid) return '暂时不支持私聊'
    if (!db[gid]) db[gid] = {}
    let isAdmin = ['owner', 'admin'].includes(data.sender.role)
    if (!isAdmin && ['绑定', '解绑', '添加', '删除', '重置', '开赛'].includes(cmd))
        return '你没有权限'
    let cid = 0
    let hasCid = db[gid].cid > 0
    if (hasCid)
        cid = db[gid].cid
    if (cmd === '')
        return help
    else if (!hasCid && cmd !== '绑定')
        return '尚未绑定比赛'
    else {
        try {
            let res = ''
            switch (cmd) {
                case '绑定':
                    if (hasCid)
                        return '已经绑定过比赛了，需要先解绑才能再次绑定。'
                    cid = parseInt(param)
                    if (!cid)
                        return '请输入正确的赛事id。'
                    if (db.cids.has(cid))
                        return cid + '已经被绑定了。'
                    await callApi('fetchContestInfo', cid)
                    db.cids.add(cid)
                    db[gid].cid = cid
                    return cid + "绑定成功。"
                    break
                case '解绑':
                    if (!db[gid].cid)
                        return '尚未绑定比赛。'
                    delete db[gid].cid
                    db.cids.delete(cid)
                    return cid + "解绑成功。(为了安全请务必删除大会室后台的管理权限)"
                    break
                case '更新':
                case '刷新':
                    await callApi('renew', cid)
                    return '好了'
                    break
                case '情报':
                    let info = await callApi('fetchContestInfo', cid)
                    let rule = await callApi('fetchContestGameRule', cid)
                    res = '[赛事基本信息]'
                    res += '\n赛事ID: ' + info.contest_id
                    res += '\n赛事名: ' + info.contest_name
                    res += '\n开始日: ' + moment.unix(info.start_time).utcOffset(8).format("YYYY/M/D HH:mm")
                    res += '\n结束日: ' + moment.unix(info.finish_time).utcOffset(8).format("YYYY/M/D HH:mm")
                    res += '\n公开的: ' + (info.open ? '是' : '否')
                    res += '\n自动匹配: ' + (info.auto_match ? '是' : '否')
                    res += '\n游戏类型: ' + ['四人東','四人南','三人東','三人南'][rule.round_type-1]
                    res += '\n食断有无: ' + (rule.shiduan ? '有' : '无')
                    res += '\n赤宝数量: ' + rule.dora_count + '枚'
                    res += '\n思考时间: ' + ['3+5秒','5+10秒','5+20秒','60+0秒'][rule.thinking_type-1]
                    res += '\n详细规则: ' + (rule.use_detail_rule ? '默认规则' : '非默认规则')
                    return res
                    break
                case '公告':
                    let notice = await callApi('fetchContestNotice', cid)
                    res = '\n[外部公告]\n'
                    res += notice[0]
                    res += '\n\n[详细公告]\n'
                    res += notice[1]
                    return res
                    break
                case '选手':
                case '名单':
                    let playerList = await callApi('fetchContestPlayer', cid)
                    res = '[参赛花名册]\n'
                    if (!playerList.length)
                        res += '(空)\n'
                    {
                        let players = []
                        for (let v of playerList)
                            players.push(v.nickname)
                        res += players.join(',')
                    }
                    return res
                    break
                case '大厅':
                    let lobby = await callApi('startManageGame', cid)
                    res = '\n[对局中]\n'
                    if (!lobby.games.length)
                        res += '(无)\n'
                    for (let v of lobby.games) {
                        let players = []
                        for (let vv of v.players) {
                            players.push(vv.nickname ? vv.nickname : '电脑')
                        }
                        res += players.join(',') + ' / ' + moment.unix(v.start_time).utcOffset(8).format("HH:mm:ss") + '开始 / ' + v.game_uuid.substr(0, 15) + '\n'
                    }
                    res += '\n[准备中]\n'
                    if (!lobby.games.players)
                        res += '(无)\n'
                    {
                        let players = []
                        for (let v of lobby.players)
                            players.push(v.nickname)
                        res += players.join(',')
                    }
                    return res
                    break
                case '添加':
                    if (!param)
                        return '请输入ID'
                    res = await callApi('addContestPlayer', cid, param)
                    return '添加' + u(res)
                    break
                case '删除':
                    if (!param)
                        return '请输入ID'
                    res = await callApi('removeContestPlayer', cid, param)
                    return '删除' + u(res)
                    break
                case '重置':
                    if (!param)
                        return '请输入ID ※删除全部选手输入:"dhs重置 确认"'
                    if (param === '确认')
                        param = ''
                    res = await callApi('updateContestPlayer', cid, param)
                    return '重置' + (param !== '' ? u(res) : '成功')
                    break
                case '开赛':
                    if (!param)
                        return '请输入ID'
                    res = await callApi('createContestGame', cid, param.replace(/！/g,'!').replace('/（/g','(').replace('/）/g',')'))
                    return res.info
                    break
                default:
                    return help
                    break
            }
        } catch (e) {
            let error = e.error
            if (error.code === 9999)
                return '连接雀魂服务器失败，请再试一次。如果在维护就别试了。'
            if (error.code === 9997)
                return '响应超时，可能已经执行成功。'
            if (error.message)
                return error.message
            if (debug)
                return e
            return '没有获取到后台管理权限，如果删除了权限请及时解绑。'
        }
    }
}

module.exports = main
