var express = require('express');
var router = express.Router();
var { config } = require('../config.js');
var mysql = require('mysql');

// heat Game Library
var HGame =require('@ethernity/heat-games');

var conn = mysql.createConnection(config.mysql)

/* GET users listing. */
router.post('/', function(req, res, next) {

	console.log("REQ:", req.body)
	const data = req.body

	const params = {
	    game_id: data.game_id,
        account_id: data.account_id,
	}

	console.log("listen:", params)
	conn.query(
		'select * from games WHERE id = ?', [
			params.game_id,
		], function(error, results, fields) {

		if (error) {
			res.send({error: error})
			return
		}

		res.send(
			results[0]
		);
	})
});

module.exports = router;
