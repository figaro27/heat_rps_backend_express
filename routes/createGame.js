var express = require('express');
var router = express.Router();
var { config } = require('../config.js');
var mysql = require('mysql');
var crypto = require('crypto');
var { v4 } = require('uuid');
const uuidv4 = v4;

// heat Game Library
var HGame = require('@ethernity/heat-games');

var conn = mysql.createConnection(config.mysql);


/* GET users listing. */
router.post('/', function(req, res, next) {

	console.log("REQ:", req.body)
	const data = req.body

	const params = {
		private: data.private,
		rounds: data.rounds,
		amount: data.amount
	}

	const game_pin = uuidv4()

	conn.query(
		'insert into games (game_pin, rounds, amount, private, status, created_at) values (?, ?, ?, ?, ?, UTC_TIMESTAMP())', [
			game_pin,
			params.rounds,
			params.amount,
			params.private,
			'CREATED'
		], async function(error, results, fields) {

		if (error) {
			res.send({error: error})
			return
		}

		const response = {
			game_id: results.insertId,
			game_pin,
		}

	  res.send(response);
	})



});



module.exports = router;
