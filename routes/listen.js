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

// heat Game Library
var HGame = require('@ethernity/heat-games');
HGame.Config({isTestnet: true})

var conn = mysql.createConnection(config.mysql);

/* GET users listing. */
router.post('/', function(req, res, next) {

	console.log("REQ:", req.body)
	const data = req.body

	const params = {
	    game_id: data.game_id,
        account_password: data.account_password,
	}


	if (!params.account_password) {
		res.send({
			status: 'ERROR',
			error: 'Need to authenticate'
		})
		return
	}

	var thisPlayer // It will detect player from the password

	console.log("listen:", params)

	conn.query('select * from games where id = ?', [
		params.game_id
		], function(error, game, fields) {

		if (!game[0]) {
			res.send({
				status: 'ERROR',
				error: 'Could not retrieve the game'
			})
			return
		}

		// Authenticate user

		// let hash = HGame.aesEncrypt(game[0].game_pin, params.account_password)
		let hash = HeatSDK.crypto.fullNameToHash(params.account_password)

		console.log("HASH:", hash)
		console.log("DATA:", game[0].game_pin, params.account_password)
		if (hash === game[0].hash1) {
			thisPlayer = 1
		}
		else if (hash === game[0].hash2) {
			thisPlayer = 2
		}
		else {
			res.send({
				status: 'ERROR',
				error: 'Wrong password or game id'
			})
			return	
		}

		console.log("PLAYER IDENTIFIED:", thisPlayer)

		conn.query(
			'select move, password, player, round, card from moves WHERE game_id = ? ORDER BY round', [
				params.game_id,
			], (error, results, fields) => {

			if (error) {
				res.send({error: error})
				return
			}
			let player1 = []
			let player2 = []

			results.map(result => {
				if (result.player === 1) {
					player1.push(result)
				} else {
					player2.push(result)
				}
			})

			console.log("PLAYER1:", player1)
			console.log("PLAYER2:", player2)
			player1.map((result, index) => {

				console.log("THIS PLAYER1:", thisPlayer)

				if (!player2[index] && thisPlayer === 2) {
					console.log("PLAYER 1 DELETES:", player1[index].card)
					player1[index].card = result.move
					player1[index].move = player1[index].card
					delete player1[index].password
				} else {
					console.log("PLAYER 1 MAINTAIN:", player1[index].card)
					player1[index].card = result.card // HGame.aesDecrypt(player1[index].card, player1[index].password)
					player1[index].move = player1[index].move
				}
				
			})

			player2.map((result, index) => {	

				console.log("THIS PLAYER2:", thisPlayer)

				if (!player1[index] && thisPlayer === 1) {
					console.log("PLAYER 2 DELETES:", player2[index].card)
					player2[index].card = result.move
					player2[index].move = player2[index].card	
					delete player2[index].password
				} else {
					console.log("PLAYER 1 MAINTAIN:", player2[index].card)
					player2[index].card = result.card // HGame.aesDecrypt(player2[index].card, player2[index].password)
					player2[index].move = player2[index].move
				}
				
			})

			res.send({
				status: "OK",
				player1,
				player2,
				status: game[0].status,
				winner: game[0].winner
			});
				

		})

	  })
});

module.exports = router;
