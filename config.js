'use strict'
module.exports = {
	port: 3001, //监听的端口
	allowed: [], //允许连接的地址，空则无限制
	dhs_url: 'wss://gateway-v2.maj-soul.com:9553', //雀魂后台地址，一般不用修改
	eid: '25331349(查询)', //雀魂加好友ID
	master: [372914165,2308941253], //主人QQ列表
    cqhttp_url: "http://localhost:5700" //cqhttp API地址
}
