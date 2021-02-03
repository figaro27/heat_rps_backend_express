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
		account_id: data.account_id,
		account_password: data.account_password,
		move: data.move,
		password: data.password,
		round: data.round,
		player: data.player,
		card: data.card,
		blockchain_hash: data.blockchain_hash
	}

	console.log("params:", params)

	// Verify player


	conn.query('select * from games where id = ?', [
		params.game_id
		], async function(err, game, fields) {

		// Identify player

		// const hash = HGame.aesEncrypt(game[0].game_pin, params.password)
		const hash = HeatSDK.crypto.fullNameToHash(params.account_password)

		if (hash !== game[0].hash1 && params.player === 1 || 
			hash !== game[0].hash2 && params.player === 2
		) {
			res.send({
				error: 'Player not identified',
			})
			return	
		}

		// Validate game status

		if (game[0].status !== "STARTED") {
			res.send({
				status: 'ERROR',
				error: 'Game is not ready for playing',
			})
			return	
		}

		// Validate if player is allowed

		conn.query(
			'select * from moves where game_id = ?', [
				params.game_id,
			], (error, players, fields) => {

			let [ player1, player2 ] = countMoves(players)

			if ( params.player === 1 && (player2.length - player1.length) < 0 ) {
				res.send({
					status: 'ERROR',
					error: 'Duplicate move',
				})
				return
			}
			if ( params.player === 2 && (player1.length - player2.length) < 0 ) {
				res.send({
					status: 'ERROR',
					error: 'Duplicate move',
				})
				return
			}

			// Broadcast the message

			const vars = {
				card: params.move,
				secret: config.secret,
				opponent: params.player === 1 ? game[0].account_id2 : game[0].account_id1,
			}

			const data = HGame.makeMove(vars);

			if ( data && data.errorCode ) {
				res.send({
					status: 'ERROR',
					error: 'Move could not be broadcasted',
					errorCode: data.errorCode
				})
				return
			}

			// Store data in DB

			conn.query(
				'insert into moves (game_id, round, move, password, player, blockchain_hash, card, created_at) values (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())', [
					params.game_id,
					params.round,
					JSON.parse(params.move).move,
					params.password,
					params.player,
					data.fullHash,
					params.card
				], function(error, results, fields) {

				if (error) {
					res.send({error: error})
					return
				}

				conn.query(
					'select * from games where id = ?', [
						params.game_id,
					], (error, game, fields) => {

					console.log("GAME:", game)

					conn.query(
						'select * from moves where game_id = ?', [
							params.game_id,
						], (error, data, fields) => {

						if (error) {
							res.send({error: error})
							return
						}

						let i = 0
						let rounds = []
						let [ player1, player2 ] = countMoves(data)

						console.log("PLAYER1:", player1)
						console.log("PLAYER2:", player2)

						while (player1[i] && player2[i]) {
							if (player1[i].card === player2[i].card) rounds.push({winner: 0})
							if (player1[i].card === 'rock' && player2[i].card === 'paper') rounds.push({winner: 2})
							if (player1[i].card === 'rock' && player2[i].card === 'scissor') rounds.push({winner: 1})
							if (player1[i].card === 'paper' && player2[i].card === 'rock') rounds.push({winner: 1})
							if (player1[i].card === 'paper' && player2[i].card === 'scissor') rounds.push({winner: 2})
							if (player1[i].card === 'scissor' && player2[i].card === 'rock') rounds.push({winner: 2})
							if (player1[i].card === 'scissor' && player2[i].card === 'paper') rounds.push({winner: 1})
							i++
						}

						// Determine who is the winner

						let wins1 = 0;
						let wins2 = 0;
						let draws = 0;
						let winner = 0;
						let finished = false

						if (rounds.length > 0) {
							for (i = 0; i < game[0].rounds && i < rounds.length; i++) {
								if (rounds[i].winner === 1) wins1++
								if (rounds[i].winner === 2) wins2++
								if (rounds[i].winner === 0) draws++
							}
						}

						console.log("ROUNDS:", rounds)
						console.log("ROUNDSN:", game[0].rounds)
						console.log("WINS:", wins1, wins2)

						// If rounds are completed, change winner to 3 to set to "draw"
						// Will be modified immediately in any player won
						if (rounds.length >= game[0].rounds) winner = 3
						if (wins1 > ((game[0].rounds - draws) / 2)) winner = 1
						if (wins2 > ((game[0].rounds - draws) / 2)) winner = 2

						if (winner > 0) {
							// If there are a winner or draw

							finished = true

							// Stores in DB
							conn.query(
								'update games set winner = ?, status = ?, ended_at = UTC_TIMESTAMP() where id = ?', [
									winner,
									'FINISHED',
									params.game_id,
								], function(error, result, fields) {
									if (error) {
										console.log("UPDATE ERROR:", error)
										return
									}
							})
						}

						// Make payment

						// Payment = (bet - fee) * 2 bets
						let payment = parseInt(game[0].amount * (100 - config.fee) / 100)

						let paymentParams = {
							amount: payment * 2,
						    secret: config.secret,
						    message: "You won the game #" + game[0].id
						}

						if (winner === 1 || winner === 2) {
							paymentParams.recipient = (winner === 1) ? game[0].account_id1 : game[0].account_id2
							HGame.sendMoney(paymentParams)	
						}

						if (winner === 3) {
							paymentParams.amount = payment
							paymentParams.recipient = game[0].account_id1
							paymentParams.message = "You draw the game #" + game[0].id
							HGame.sendMoney(paymentParams)
							paymentParams.recipient = game[0].account_id2
							HGame.sendMoney(paymentParams)
						}

						// Send response

						res.send({
							winner,
							results,
							finished
						});
					})
				})
			})
		})
	})
});


function countMoves(data) {

	let player1 = []
	let player2 = []

	data.map(result => {
		if (result.player === 1) {
			player1.push(result)
		} else {
			player2.push(result)
		}
	})

	return [ player1, player2 ]
}

module.exports = router;
