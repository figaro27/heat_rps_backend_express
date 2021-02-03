var express = require('express');
var router = express.Router();
var { config } = require('../config.js');
var mysql = require('mysql');
const heatsdk = require('heat-sdk');
const HeatConfig = new heatsdk.Configuration({
  isTestnet: true, 
  // baseURL: "http://localhost:7733/api/v1", websocketURL: "ws://localhost:7755/ws/"
})
var HeatSDK = new heatsdk.HeatSDK(HeatConfig)

var conn = mysql.createConnection(config.mysql)

// heat Game Library
var HGame = require('@ethernity/heat-games');
HGame.Config({isTestnet: true})

/* GET users listing. */
router.post('/', function(req, res, next) {

	const data = req.body

	let player

	conn.query('select * from games where id = ?', [
		data.game_id
		], function(err, game, fields) {

		// const hash = HGame.aesEncrypt(game[0].game_pin, data.password)
		const hash = HeatSDK.crypto.fullNameToHash(data.password)

		console.log("HASH:", hash)
		if (hash === game[0].hash1) {
			player = 1
		}
		else if (hash === game[0].hash2) {
			player = 2
		}
		else {
			res.send({
				error: 'Player not identified',
			})
			return	
		}

		res.send({
			id: game[0].id,
			pin: game[0].game_pin,
			amount: game[0].amount,
			rounds: game[0].rounds,
			status: game[0].status,
			account_id: player === 1 ? game[0].account_id1 : game[0].account_id2,
		    account_name: player === 1 ? game[0].account_name1 : game[0].account_name2,
		    opponent_id: player === 1 ? game[0].account_id2 : game[0].account_id1,
		    opponent_name: player === 1 ? game[0].account_name2 : game[0].account_name1,
			player
		})

	})

});



module.exports = router;
