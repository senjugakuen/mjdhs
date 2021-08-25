'use strict'
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const http = require('http')
const dhs = require('./dhs')
const config = require('./config')

const bots = new Set

let running = false
let db = { }

function saveDbSync() {
    return fs.promises.writeFile(path.join(__dirname, './db'), JSON.stringify(db))
}

async function start() {
    try {
        db = JSON.parse(await fs.promises.readFile(path.join(__dirname, './db')))
    } catch { }
    console.log(Date(), "雀魂大会室管理系统启动")
    dhs.start(config.account, config.password, {url: config.dhs_url})
    running = true
}
function stop() {
    running = false
    return new Promise((resolve)=>{
        console.log(Date(), "雀魂大会室管理系统停止")
        dhs.close(resolve)
    })
}

const isMaster = (id)=>{
    return config.master.includes(id)
}

function reboot() {
    return stop().then(start)
}

const callApi = async(method, cid, param)=>{
    cid = Math.abs(cid)
    return new Promise((resolve, reject)=>{
        dhs.callApi(method, cid, (data)=>{
            if (!data) resolve(data)
            if (data.hasOwnProperty('error'))
                reject(data)
            else
                resolve(data)
        }, [param])
    })
}

const help = `-----大会室指令说明-----
第①步 在大会室后台将 ${config.eid} 设置为比赛管理
第②步 输入"%绑定 赛事id"将qq群和比赛绑定, 就可使用以下指令
● 查询类指令(%为前缀)
%规则 / %名单 / %公告
%大厅 / %待机 / %排名
● 比赛类指令(开赛以外须小绿人权限)
%开赛 / %终止 / %暂停 / %恢复
%添加 / %删除 / %重置 
● 系统类指令(解绑须小绿人权限)
%绑定 / %解绑 / %帮助 / %播报`

const kaisai = `-----开赛指令说明-----
● 设置选手(选手不足自动添加电脑)
%开赛 A君,B君,C君
● 设置点数(没名字的代表电脑)
%开赛 A君 500,B君 500,500,500
● 固定座位法: 在第一个选手前添加"!"
● 设置标签法: 在最后添加"||tag"
※半角逗号分隔每个选手, 空格分隔选手和点数
※可以用换行代替逗号分隔每个选手`

const ranks = ["初心","雀士","雀杰","雀豪","雀圣","魂天"]
const getRank = id=>{
    id = id.toString()
    let res = ranks[id[2]-1] + id[4]
    return res ===  "魂天1" ? "魂天" : res
}
const other_rules = {
    'have_helezhongju':'和了终局',
    'have_tingpaizhongju':'听牌终局',
    'have_helelianzhuang':'和了连庄',
    'have_tingpailianzhuang':'听牌连庄',
    'have_yifa':'一发',
    'have_liujumanguan':'流局满贯',
    'have_qieshangmanguan':'切上满贯',
    'have_biao_dora':'表宝牌',
    'have_gang_biao_dora':'杠表宝牌',
    'ming_dora_immediately_open':'杠表即开',
    'have_li_dora':'里宝牌',
    'have_gang_li_dora':'杠里宝牌',
    'have_sifenglianda':'四风连打流局',
    'have_sigangsanle':'四杠散了流局',
    'have_sijializhi':'四家立直流局',
    'have_jiuzhongjiupai':'九种九牌流局',
    'have_sanjiahele':'三家和了流局',
    'have_toutiao':'头跳',
    'have_nanruxiru':'南入西入',
    'disable_multi_yukaman':'多倍役满',
    'guyi_mode':'古役'
}

const u = (res)=>{
    let failure = res.total - res.success
    return `成功${res.success}个(${res.nicknames})。` + (failure ? failure + '个ID是空号。' : '')
}

const findGid = (cid)=>{
    return parseInt(Object.keys(db).find(k=>db[k]===cid))
}

async function onmessage(data) {
    if (!running)
        return "插件可能正在重启，请再试一次"
    let message = data.raw_message.trim()
    let prefix
    if (message.substr(0, 3).toLowerCase() === 'dhs') {
        prefix = 'dhs'
        message = message.substr(3).trim()
    } else if (message.substr(0, 1) === '%') {
        prefix = message.substr(0, 1)
        message = message.substr(1).trim()
    } else {
        return
    }
    let cmd = message.substr(0, 2)
    cmd = cmd.replace("啟","启")
        .replace("幫","帮")
        .replace("綁","绑")
        .replace("報","报")
        .replace("規則","规则")
        .replace("選","选")
        .replace("單","单")
        .replace("廳","厅")
        .replace("機","机")
        .replace("開賽","开赛")
        .replace("終","终")
        .replace("暫","暂")
        .replace("復","复")
    if (isMaster(data.user_id) && cmd === '重启') {
        data.reply("开始重启插件")
        await reboot()
        return '重启完成'
    }
    if ((prefix === 'dhs' && cmd === '') || cmd === '帮助')
        return help

    let param = message.substr(2).trim().replace(/&amp;/g, "&").replace(/(\r\n|\n|\r)/g,',')
    let gid = data.group_id
    if (!gid) return 'dhs各指令只能在群里使用'
    let is_admin = ['owner', 'admin'].includes(data.sender.role)
    let cid = 0
    if (db[gid]) cid = db[gid]
    if (!cid && cmd !== "绑定")
        return '尚未绑定比赛。需要帮助输入: %帮助'
    else {
        if (!is_admin && !isMaster(data.user_id) && ['解绑', '添加', '删除', '重置', '停止', '终止', '暂停', '恢复', '开赛'].includes(cmd))
            return '这个指令需要小绿人权限'
        try {
            let res = ''
            switch (cmd) {
                case '播报':
                    cid = 0 - cid
                    db[gid] = cid
                    await saveDbSync()
                    if (cid > 0)
                        return "播报已关闭"
                    else
                        return "播报已开启"
                    break
                case '绑定':
                    if (cid)
                        return '已经绑定过比赛了，需要先解绑才能再次绑定。'
                    cid = parseInt(param)
                    if (!cid)
                        return '请输入正确的赛事id。'
                    if (findGid(cid) || findGid(0-cid))
                        return cid + '已经绑定了其他群。'
                    await callApi('startManageGame', cid)
                    db[gid] = cid
                    await saveDbSync()
                    return cid + "绑定成功。"
                    break
                case '解绑':
                    if (!cid)
                        return '尚未绑定比赛。'
                    delete db[gid]
                    await saveDbSync()
                    return cid + "解绑成功。(为了安全请务必删除大会室后台的管理权限)"
                    break
                case '更新':
                case '刷新':
                    let contest_list = await callApi('renew', cid)
                    for (let k in db) {
                        if (!contest_list.hasOwnProperty(Math.abs(db[k])))
                            delete db[k]
                    }
                    await saveDbSync()
                    return '好了'
                    break
                case '规则':
                    let info = await callApi('fetchContestInfo', cid)
                    let rule = await callApi('fetchContestGameRule', cid)
                    res = `[赛事ID:${info.contest_id}(${info.open?'公开':'私密'})]`
                    res += '\n赛事名: ' + info.contest_name
                    res += '\n开始日: ' + moment.unix(info.start_time).utcOffset(8).format("YYYY/M/D H:mm")
                    res += '\n结束日: ' + moment.unix(info.finish_time).utcOffset(8).format("YYYY/M/D H:mm")
                    res += '\n自动匹配: ' + (info.auto_match ? '是' : '否')
                    let hint = rule.detail_rule_v2.game_rule.bianjietishi ? '有' : '无'
                    res += '\n思考时间: ' + ['3+5秒','5+10秒','5+20秒','60+0秒'][rule.thinking_type-1] + ` (${hint}便捷提示)`
                    if (rule.detail_rule_v2.extra_rule) {
                        let required_level = rule.detail_rule_v2.extra_rule.required_level
                        if (required_level)
                            res += '\n段位限制: ' + (required_level ? getRank(required_level) : '无')
                        let max_game_count = rule.detail_rule_v2.extra_rule.max_game_count
                        if (max_game_count)
                            res += '\n局数限制: ' + max_game_count
                    }
                    res += '\n游戏类型: ' + {1:'四人東',2:'四人南',11:'三人東',12:'三人南'}[rule.round_type] + ` / ${rule.shiduan?'有':'无'}食断 / ${rule.dora_count}枚赤宝`
                    let detail = rule.detail_rule_v2.game_rule
                    res += '\n点数设定: ' + `初始${detail.init_point} / 返点${detail.fandian} / 精算${detail.jingsuanyuandian}`
                    res += '\n击飞和天边: ' + (detail.can_jifei ? `${detail.tianbian_value}点以下击飞` : '无击飞')
                    res += '\n立直棒场棒: ' + detail.liqibang_value + '点 / ' + detail.changbang_value + '点'
                    res += '\n顺位马差马: ' + `二位${detail.shunweima_2} / 三位${detail.shunweima_3}` + ([1,2].includes(rule.round_type) ? ` / 四位${detail.shunweima_4}` : '')
                    let enabled = [], disabled = []
                    for (let i in other_rules) {
                        if (i === 'disable_multi_yukaman')
                            detail[i] = !detail[i]
                        if (detail[i])
                            enabled.push(other_rules[i])
                        else
                            disabled.push(other_rules[i])
                    }
                    res += '\n关闭的规则: ' + disabled.join(', ')
                    res += '\n开启的规则: ' + enabled.join(', ')
                    return res
                    break  
                case '公告':
                    let notice = await callApi('fetchContestNotice', cid)
                    res = '\n[外部公告]\n'
                    res += notice[0]
                    res += '\n[详细公告]\n'
                    res += notice[1]
                    return res
                    break
                case '选手':
                case '名单':
                    let playerList = await callApi('fetchContestPlayer', cid)
                    res = `[参赛花名册(${playerList.length}个)]\n`
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
                    res = `\n[对局中(${lobby.games.length}个)]\n`
                    if (!lobby.games.length)
                        res += '(无)\n'
                    for (let v of lobby.games) {
                        let players = []
                        for (let vv of v.players) {
                            players.push(vv.nickname ? vv.nickname : '电脑')
                        }
                        res += players.join(',') + ' / ' + moment.unix(v.start_time).utcOffset(8).format("H:mm:ss") + '开始 / ' + v.game_uuid + '\n'
                    }
                    res += `\n[准备中(${lobby.players.length}个)]\n`
                    if (!lobby.players.length)
                        res += '(无)\n'
                    {
                        let players = []
                        for (let v of lobby.players)
                            players.push(v.nickname)
                        res += players.join(',')
                    }
                    return res
                    break
                case '待机':
                    let waitings = (await callApi('startManageGame', cid)).players
                    res += `[准备中(${waitings.length}个)]\n`
                    if (!waitings.length)
                        res += '(无)\n'
                    {
                        let players = []
                        for (let v of waitings)
                            players.push(v.nickname)
                        res += players.join(',')
                    }
                    return res
                    break
                case '排名':
                    let rankList = await callApi('fetchCurrentRankList', cid)
                    res = `[当前排名(${rankList.length}个)]\n`
                    if (!rankList.length)
                        res += '(空)'
                    else
                        res += '姓名 / 总分 / 对局数'
                    let rank_index = 0
                    for (let v of rankList) {
                        rank_index++
                        res += `\n${rank_index}. ${v.nickname} / ${v.total_point} / ${v.total_count}`
                    }
                    return res
                    break
                case '添加':
                    if (!param)
                        return '请加上选手ID, 半角逗号或换行分隔'
                    res = await callApi('addContestPlayer', cid, param)
                    return '添加' + u(res)
                    break
                case '删除':
                    if (!param)
                        return '请加上选手ID, 半角逗号或换行分隔'
                    res = await callApi('removeContestPlayer', cid, param)
                    return '删除' + u(res)
                    break
                case '重置':
                    if (!param)
                        return '请加上选手ID ※要删除全部选手输入:"dhs重置 确认"'
                    if (param === '确认')
                        param = ''
                    res = await callApi('updateContestPlayer', cid, param)
                    return '重置' + (param !== '' ? u(res) : '成功')
                    break
                case '开赛':
                    if (param === '?' || param === '？')
                        return kaisai
                    res = await callApi('createContestGame', cid, param)
                    let tag = param.split('||')[1]
                    tag = tag ? tag : ''
                    if (res.result) 
                        return //`${tag}开赛成功。`
                    else
                        return `${tag}开赛失败。 ${res.message}。${param?'':'\n※查看开赛详细用法输入: %开赛?'}`
                    break
                case '停止':
                case '终止':
                    if (!param)
                        return '请加上游戏编号'
                    res = await callApi('terminateGame', cid, param)
                    return '游戏已终止。 编号: ' + param
                    break
                case '暂停':
                    if (!param)
                        return '请加上游戏编号'
                    res = await callApi('pauseGame', cid, param)
                    return '游戏已暂停。 编号: ' + param
                    break
                case '恢复':
                    if (!param)
                        return '请加上游戏编号'
                    res = await callApi('resumeGame', cid, param)
                    return '游戏已恢复。 编号: ' + param
                    break
                default:
                    return '指令不正确。需要帮助输入: %帮助'
                    break
            }
        } catch (e) {
            if (!e.error) {
                fs.appendFile('err.log', Date() + ' ' + e.stack + '\n', () => { })
                return '未知错误。'
            }
            let error = e.error
            if (error.code === 9999)
                return '连接雀魂服务器失败，请再试一次。'
            if (error.code === 9997)
                return '响应超时，可能已经执行成功。'
            if (error.code === 9000 || error.code === 2501)
                return `没有赛事${error.cid}的管理权限，请把 ${config.eid} 添加为赛事管理。`
            if (error.code === 2505) {
                reboot()
                return '遇到错误，需要重启，请再试一次'
            }
            if (error.code === 2521)
                return '自动匹配模式下不能手动开赛。'
            if (error.code === 1203)
                return '游戏编号错误。'
            if (error.code === 1210)
                return '游戏编号错误(已经执行了该操作)。'
            fs.appendFile('err.log', Date() + ' Error.code: ' + error.code + '\n', () => { })
            return `执行失败(错误码:${error.code})。`
        }
    }
}

// 主动发送群消息
const sendGroupMessage = (gid, msg)=>{
    for (let bot of bots) {
        if (bot.gl.has(gid))
            bot.sendGroupMsg(gid, msg)
    }
}

// 选手 准备&取消 通知
dhs.events.on('NotifyContestMatchingPlayer', async(data)=>{
    let gid = findGid(0 - data.contest_id)
    if (!gid || data.type !== 1) return
    let cnt = (await callApi('startManageGame', data.contest_id)).players.length
    let msg = `${data.nickname} 在大会室准备 ` + (cnt<4?`(${cnt}=${4-cnt})`:`(${cnt}人已准备)`)
    sendGroupMessage(gid, msg)
})

// 游戏 开始&结束 通知
dhs.events.on('NotifyContestGameStart', (data)=>{
    let uuid = data.game_info.game_uuid
    let gid = findGid(0 - data.contest_id)
    if (!gid)
        gid = findGid(data.contest_id)
    if (!gid)
        return
    let msg = '对局开始: '
    let players = []
    for (let player of data.game_info.players) {
        players.push(player.nickname?player.nickname:'电脑')
    }
    msg += players.join()// + ' / ' + uuid
    sendGroupMessage(gid, msg)
})
dhs.events.on('NotifyContestGameEnd', async(data)=>{
    let uuid = data.game_uuid
    let gid = findGid(0 - data.contest_id)
    // if (!gid)
    //     gid = findGid(data.contest_id)
    if (!gid)
        return
    let msg = '对局结束: /?paipu=' + uuid
    let result = await new Promise((resolve)=>{
        http.get('http://usus.lietxia.bid/api?m=fetchGameRecord&game_uuid='+uuid, (res)=>{
            let data = ''
            res.on('data', chunk=>{
                data += chunk
            })
            res.on('end', chunk=>{
                try {
                    resolve(JSON.parse(data))
                } catch(e) {
                    resolve({error:0})
                }
            })
        }).on('error', ()=>{
            resolve({error:0})
        })
    })
    if (result.hasOwnProperty('error')) {
        if (result.error.code === 1203)
            msg += '\n对局被终止'
        else
            msg += '\n请求结果时遇到网络错误'
    } else {
        msg += `\n${moment.unix(result.head.start_time).utcOffset(8).format("H:mm:ss")} - ${moment.unix(result.head.end_time).utcOffset(8).format("H:mm:ss")}`
        for (let player of result.head.result.players) {
            let nickname = '电脑'
            if (result.head.hasOwnProperty('accounts')) {
                for (let account of result.head.accounts) {
                    if (account.seat === player.seat) {
                        nickname = account.nickname
                    }
                }
            }
            msg += `\n${nickname} ${player.part_point_1}`
        }
    }
    sendGroupMessage(gid, msg)
})

// 公告更新 好像无效?
// dhs.events.on('NotifyContestNoticeUpdate', (data)=>{
//     let gid = findGid(0 - data.contest_id)
//     let type = ['外部公告', '详细公告', '管理员公告'][data.notice_type - 1]
//     sendGroupMessage(gid, '管理员更新了大会室' + type)
// })

module.exports = {
    onmessage, bots,
    start, stop
}
