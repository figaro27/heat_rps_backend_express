var express = require('express');
var router = express.Router();
var { config } = require('../config.js');
var mysql = require('mysql');
var crypto = require('crypto');
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
router.post('/', async function(req, res, next) {


	const params = req.body

	// Read game data from database to data

	conn.query(
		'select * from games where id = ?', [
			params.game_id
		], async function(error, results, fields) {

		if (error) {
			res.send({error: error})
			return
		}

		const game = results[0]

		if (!game) {
			res.send({
				status: 'Error',
				error: 'Game not found'
			})
			return
		}


		if (game.status !== 'CREATED' && game.status !== 'FUNDED') {
			res.send({
				status: 'Error',
				error: 'Game already funded'
			})
			return
		}

		console.log("GAME DATA:", game)


		// Read payments to the main account

		var payments
		try {

			// txs = await HeatSDK.api.get('/blockchain/transactions/account/count/' + config.mainAccount)
			payments = await HeatSDK.api.get('/blockchain/transactions/account/' + config.mainAccount + '/0/100')
			// payments = await HeatSDK.api.get('/account/payments/' + config.mainAccount + '/all/sender/true/0/100')
			// const payments = [{"senderPublicKey":"cfa1a9c50f968a5679afc1bf655a57c304303b0ebb8e1bb47ef9d466494ac117","quantity":"1000000000","isAtomicTransfer":false,"messageBytes":null,"senderPrivateName":"0","recipientPublicKey":"2d2f54c4083ddbec05f6388629256c0d30442a82d4fc93dd895b19392caf8a6b","num":0,"recipientPublicName":"fatimaflash@heatwallet.com","blockId":"1175507056069217945","recipientPrivateName":"191228147823482996","messageIsEncrypted":false,"sender":"4729421738299387565","recipient":"6768971178720561498","currency":"0","senderPublicName":"4729421738299387565","messageIsText":false,"transaction":"15855574190846869877","timestamp":197617508,"height":2016820},{"senderPublicKey":"2d2f54c4083ddbec05f6388629256c0d30442a82d4fc93dd895b19392caf8a6b","quantity":"500000000","isAtomicTransfer":false,"messageBytes":null,"senderPrivateName":"191228147823482996","recipientPublicKey":"e9541407cdcbaf9074b14000f998a7552d993e9cec6ef121c9404ac7afb2af20","num":0,"recipientPublicName":"6784667316812263159","blockId":"12836823328106651490","recipientPrivateName":"0","messageIsEncrypted":false,"sender":"6768971178720561498","recipient":"6784667316812263159","currency":"0","senderPublicName":"fatimaflash@heatwallet.com","messageIsText":false,"transaction":"14666288367337390019","timestamp":205585380,"height":2236322},{"senderPublicKey":"e9541407cdcbaf9074b14000f998a7552d993e9cec6ef121c9404ac7afb2af20","quantity":"1000000","isAtomicTransfer":false,"messageBytes":"e07bbcf33e85b99d08ec0e795c1af0f2af1f3c82d8705b4b025701b44a8de7d4e7e078e58aed86fedd1468e37443060125f297fd051c7dd9d4b079c00c565cfbaca3f6dbb4ac4b6353bfea46884d975e46e8d2e9c637f7607a647bc4f67cb448","senderPrivateName":"0","recipientPublicKey":"2d2f54c4083ddbec05f6388629256c0d30442a82d4fc93dd895b19392caf8a6b","num":0,"recipientPublicName":"fatimaflash@heatwallet.com","blockId":"0","recipientPrivateName":"191228147823482996","messageIsEncrypted":true,"sender":"6784667316812263159","recipient":"6768971178720561498","currency":"0","senderPublicName":"6784667316812263159","messageIsText":true,"transaction":"7927990594457546097","timestamp":213593681,"height":2147483647}]
		} catch(e) {
			console.log("ERRORPAYMENTS:", e)
		}
		const now = Math.floor(Date.now() / 1000)

		// console.log("PAYMENTS:", payments)
		console.log("LENGTH:", payments.length)
		console.log("NOW: ", now)


		// Filter payments
		var filteredPayments = 0
		var detectedPayment
		await payments.map(async (payment)=>{
			
			// Ignore payments not for this account
			if (payment.recipient !== config.mainAccount) { 
				return
			}

			// Ignore old payments
			if (payment.timestamp <= now - 600) { 
				// return
			}

			// Check amount
			if (payment.amount.toString() !== game.amount.toString()) {
				console.log("IGNORED: AMOUNT", payment.amount)
				return
			}

			// Avoid duplicate payments
			if (payment.transaction === game.transaction_id1 ||
				payment.transaction === game.transaction_id2) {
				console.log("IGNORED: TXID", payment.transaction)
				return 
			}

			// Candidate payment, go for definitive checkings
			filteredPayments++

			console.log("PAYMENT:", payment)

			// 1. Check game correspondence with message (can be intensive because decrypting)

			// 1a. Read message
			let message

			// Message is not encrypted
			if (payment.attachment.message) {
				message = payment.attachment.message
			}

			// Message is encrypted
			if (payment.messageIsEncrypted) {
				try {
					message = await HeatSDK.crypto.decryptMessage(
						payment.attachment.encryptedMessage.data, 
						payment.attachment.encryptedMessage.nonce, 
						payment.senderPublicKey, 
						config.secret
					);
				} catch (e) {
					console.log("MESSAGEERROR: ", e)
				}
			}

			console.log("MESSAGE:", message)

			// 1b. Check id (last checking)
			if (parseInt(message) === parseInt(game.id)) {
				console.log("DETECTED:", payment)
				console.log("From:", payment.senderPublicName || payment.sender)
				console.log("Amount:", parseInt(payment.amount) / 100000000)

				detectedPayment = payment
				return
			}
		})

		console.log("FILTERED:", filteredPayments)

		if (!detectedPayment) {
			res.send({
				status: 'Error',
				error: 'Payment not yet received'
			})
			return
		}


		// Create new game data

		const quantity = parseInt(detectedPayment.amount) / 1000000000

		console.log("Q:", quantity)


		const account_id = detectedPayment.sender
		const account_name = detectedPayment.senderPublicName
		const transaction_id = detectedPayment.transaction
		const password = crypto.randomBytes(12).toString('base64').slice(0,-1)

		// const hash = HGame.aesEncrypt(game.game_pin, password)
		const hash = HeatSDK.crypto.fullNameToHash(password)

		// Update DB with game data

		var saved = false
		var thisPlayer
		var query
		var queryParams

		console.log("GAME:", game)

		// Case when first player pays
		if (!game.transaction_id1 && game.status === 'CREATED') {

			console.log("CREATED:")
			query = `update games set 
					account_id1 = ?, 
					account_name1 = ?,
					rounds = ?, 
					amount = ?, 
					status = ?, 
					transaction_id1 = ?, 
					hash1 = ?, 
					created_at = UTC_TIMESTAMP(),
					funded_at = UTC_TIMESTAMP()
				where id = ?`

			queryParams = [
					account_id,
					account_name,
					game.rounds,
					game.amount,
					'FUNDED',
					detectedPayment.transaction,
					hash,
					params.game_id
				]

			thisPlayer = 1
			saved = true
		}

		// Case when opponent has paid
		if (game.transaction_id1 && game.status === 'FUNDED') {

			console.log("FUNDED:")
			query = `update games set 
					account_id2 = ?, 
					account_name2 = ?,
					status = ?, 
					transaction_id2 = ?, 
					hash2 = ?, 
					started_at = UTC_TIMESTAMP()
				where id = ?`

			queryParams = [
					account_id,
					account_name,
					'STARTED',
					detectedPayment.transaction,
					hash,
					params.game_id
				]

			thisPlayer = 2
			saved = true
		}


		// Send message with password

		if (saved) {

			conn.query(
				query,
				queryParams, 
				async function(error, results, fields) {
					if (error) {
						res.send({error: error})
						return
					}

		      const vars = {
		      	secret: config.secret,
		      	recipient: detectedPayment.sender,
		        message: 'RPS game #' + game.id + ' Your password: ' + password,
		      }

		      const sendPassword = await HGame.sendPassword(vars);

		      console.log("PASSWORD SENT:", sendPassword)

		      const response = {
		      	status: 'OK',
		      	player: thisPlayer,
		      	account_id: detectedPayment.sender,
		      	account_name: detectedPayment.senderPublicName,
		      	opponent_id: game.account_id1, // It only occurs when player is 2 (if player is 1 the value is null) 
		      	opponent_name: game.account_name1,
		      	password: password,
		      }

			  res.send(response);
			})
		}

		if (!saved) {
		      const response = {
		      	status: 'ERROR',
		      	error: 'Game not saved',
		      }

			  res.send(response);

		}

}
)
})



module.exports = router;
