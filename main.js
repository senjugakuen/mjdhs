'use strict'
const fs = require('fs')
const moment = require('moment')
const http = require('http')
const dhs = require('./dhs')
const config = require('./config')

config.account = process.env.MAJSOUL_DHS_ACCOUNT
config.password = process.env.MAJSOUL_DHS_PASSWORD
if (!config.account || !config.password) {
    console.log(`需要设置如下2个系统环境变量：
MAJSOUL_DHS_ACCOUNT 雀魂账号
MAJSOUL_DHS_PASSWORD 雀魂密码`)
    process.exit(2)
}

// 加载db
let db = {}
if (fs.existsSync('./db')) {
    db = JSON.parse(fs.readFileSync('./db'))
}
// 保存db
const saveDbSync = ()=>{
    fs.writeFileSync('./db', JSON.stringify(db))
}
process.on('exit', saveDbSync)

// 启动
dhs.start(config.account, config.password, {url: config.dhs_url})
console.log(Date(), "已启动")

const isMaster = (id)=>{
    return config.master.includes(id)
}

// 安全退出(forever或pm2自动重启)
const reboot = async()=>{
    console.log(Date(), "已停止")
    return new Promise((resolve, reject)=>{
        dhs.close(()=>resolve())
    })
}

const callApi = async(method, cid, param)=>{
    cid = Math.abs(cid)
    return new Promise((resolve, reject)=>{
        dhs.callApi(method, cid, (data)=>{
            if (data.hasOwnProperty('error'))
                reject(data)
            else
                resolve(data)
        }, [param])
    })
}

const help = `-----大会室指令说明-----
第①步 在大会室后台将 ${config.eid} 设置为比赛管理
第②步 输入".绑定 赛事id"将qq群和比赛绑定, 就可使用以下指令
● 查询类指令
dhs规则 / dhs名单 / dhs公告
dhs大厅 / dhs待机 / dhs排名
● 比赛类指令(开赛以外须小绿人权限)
dhs开赛 / dhs终止 / dhs暂停 / dhs恢复
dhs添加 / dhs删除 / dhs重置 
● 系统类指令(解绑须小绿人权限)
dhs绑定 / dhs解绑 / dhs帮助 / dhs播报`

const kaisai = `-----开赛指令说明-----
● 设置选手(选手不足自动添加电脑)
dhs开赛 A君,B君,C君
● 设置点数(没名字的代表电脑)
dhs开赛 A君 500,B君 500,500,500
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

const main = async(data)=>{
    data.message = data.message.trim()
    let prefix
    if (data.message.substr(0, 3).toLowerCase() === 'dhs') {
        prefix = 'dhs'
        data.message = data.message.substr(3).trim()
    } else if (data.message.substr(0, 1) === '.') {
        return
        prefix = data.message.substr(0, 1)
        data.message = data.message.substr(1).trim()
    } else {
        return
    }
    let cmd = data.message.substr(0, 2)
    if (isMaster(data.user_id) && cmd === '重启') {
        await reboot()
        return 'reboot'
    }
    if ((prefix === 'dhs' && cmd === '') || cmd === '帮助')
        return help

    let param = data.message.substr(2).trim().replace(/(\r\n|\n|\r)/g,',')
    let gid = data.group_id
    if (!gid) return 'dhs各指令只能在群里使用'
    let is_admin = ['owner', 'admin'].includes(data.sender.role)
    let cid = 0
    if (db[gid]) cid = db[gid]
    if (!cid && !['綁定', '绑定'].includes(cmd))
        return '尚未绑定比赛。需要帮助输入: dhs'
    else {
        if (!is_admin && !isMaster(data.user_id) && ['解綁', '解绑', '添加', '删除', '重置', '终止', '終止','暂停','暫停','恢复','恢復'].includes(cmd))
            return '这个指令需要小绿人权限'
        try {
            let res = ''
            switch (cmd) {
                case '播报':
                case '播報':
                    cid = 0 - cid
                    db[gid] = cid
                    saveDbSync()
                    if (cid > 0)
                        return "播报已关闭"
                    else
                        return "播报已开启"
                    break
                case '綁定':
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
                    saveDbSync()
                    return cid + "绑定成功。"
                    break
                case '解綁':
                case '解绑':
                    if (!cid)
                        return '尚未绑定比赛。'
                    delete db[gid]
                    saveDbSync()
                    return cid + "解绑成功。(为了安全请务必删除大会室后台的管理权限)"
                    break
                case '更新':
                case '刷新':
                    let contest_list = await callApi('renew', cid)
                    for (let k in db) {
                        if (!contest_list.hasOwnProperty(Math.abs(db[k])))
                            delete db[k]
                    }
                    saveDbSync()
                    return '好了'
                    break
                case '規則':
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
                case '選手':
                case '名單':
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
                case '大廳':
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
                        res += players.join(',') + ' / ' + moment.unix(v.start_time).utcOffset(8).format("H:mm:ss") + '开始 / ' + v.game_uuid + '\n'
                    }
                    res += '\n[准备中]\n'
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
                case '待機':
                case '待机':
                    let waitings = (await callApi('startManageGame', cid)).players
                    res += '[准备中]\n'
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
                    res = '[当前排名]\n'
                    if (!rankList.length)
                        res += '(空)'
                    else
                        res += '姓名 / 总分 / 对局数'
                    for (let v of rankList) {
                        res += `\n${v.nickname} / ${v.total_point} / ${v.total_count}`
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
                case '開賽':
                case '开赛':
                    if (param === '?' || param === '？')
                        return kaisai
                    res = await callApi('createContestGame', cid, param)
                    let tag = param.split('||')[1]
                    tag = tag ? tag : ''
                    if (res.result) 
                        return `${tag}开赛成功。`
                    else
                        return `${tag}开赛失败。 ${res.message}。${param?'':'\n※查看开赛详细用法输入: dhs开赛?'}`
                    break
                case '終止':
                case '终止':
                    if (!param)
                        return '请加上游戏编号'
                    res = await callApi('terminateGame', cid, param)
                    return '游戏已终止。 编号: ' + param
                    break
                case '暫停':
                case '暂停':
                    if (!param)
                        return '请加上游戏编号'
                    res = await callApi('pauseGame', cid, param)
                    return '游戏已暂停。 编号: ' + param
                    break
                case '恢復':
                case '恢复':
                    if (!param)
                        return '请加上游戏编号'
                    res = await callApi('resumeGame', cid, param)
                    return '游戏已恢复。 编号: ' + param
                    break
                default:
                    return '指令不正确。需要帮助输入: dhs'
                    break
            }
        } catch (e) {
            if (!e.error) {
                fs.appendFileSync('err.log', Date() + ' ' + e.stack + '\n')
                return '未知错误。'
            }
            let error = e.error
            if (error.code === 9999)
                return '连接雀魂服务器失败，请再试一次。如果在维护就别试了。'
            if (error.code === 9997)
                return '响应超时，可能已经执行成功。'
            if (error.code === 9000 || error.code === 2501)
                return `没有赛事${error.cid}的管理权限，请把 ${config.eid} 添加为赛事管理。`
            if (error.code === 2505)
                return 'reboot'
            if (error.code === 2521)
                return '自动匹配模式下不能手动开赛。'
            if (error.code === 1203)
                return '游戏编号错误。'
            if (error.code === 1210)
                return '游戏编号错误(已经执行了该操作)。'
            fs.appendFileSync('err.log', Date() + ' Error.code: ' + error.code + '\n')
            return `执行失败(错误码:${error.code})。`
        }
    }
}

// 主动发送群消息
const sendGroupMessage = (gid, msg)=>{
    // console.log(msg)
    msg = encodeURIComponent(msg)
    let url = `http://172.17.0.2:5700/send_group_msg?group_id=${gid}&message=` + msg
    http.get(url, ()=>{}).on('error', ()=>{})
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
    if (!gid) return
    let msg = '对局开始: '
    let players = []
    for (let player of data.game_info.players) {
        players.push(player.nickname?player.nickname:'电脑')
    }
    msg += players.join() + ' / ' + uuid
    sendGroupMessage(gid, msg)
})
dhs.events.on('NotifyContestGameEnd', async(data)=>{
    let uuid = data.game_uuid
    let gid = findGid(0 - data.contest_id)
    if (!gid) return
    let msg = '对局结束: ' + uuid
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

// 公告更新
dhs.events.on('NotifyContestNoticeUpdate', (data)=>{
    let gid = findGid(0 - data.contest_id)
    let type = ['外部公告', '详细公告', '管理员公告'][data.notice_type - 1]
    sendGroupMessage(gid, '管理员更新了大会室' + type)
})

module.exports = main
