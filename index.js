const WebSocket = require('ws');
const dhs = require('./dhs')
dhs.start('13564803353@qq.com', '552233', '70424026') 

const wss = new WebSocket.Server({ port: 3000 });



wss.on('connection', function connection(ws) {

	ws.on('message', function incoming(message) {
		let data = JSON.parse(message)

		const reply = (msg)=>{
			let res = {
				"action": ".handle_quick_operation",
				"params": {
					"context": data,
					"operation": {
						"reply": JSON.stringify(msg)
					}
				}
			}
			ws.send()
		}

		if (data.post_type === "message" && data.message.substr(0, 1) === "-") {
			let parmas = data.message.substr(1).split(" ")
			let method = parmas[0]
			let contestId = parmas[1]
			let param = parmas[2]
			try {
				dhs.callApi(method, contestId, (data)=>{
					reply(data)
				}, [param])
			} catch (e) {
				reply(e)
			}
		}
	});
});
