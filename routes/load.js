var express = require('express');
var router = express.Router();
var { config } = require('../config.js');
var mysql = require('mysql');

var conn = mysql.createConnection(config.mysql)

/* GET users listing. */
router.post('/', function(req, res, next) {

	console.log("REQ:", req.body)
	const data = req.body

	const params = {
		game_id: data.game_id,
	}

	conn.query(
		'select * from games where id = ?', [
			params.game_id
		], function(error, results, fields) {

		if (error) {
			res.send({error: error})
			return
		}

		res.send(results[0]);
	})



});



module.exports = router;
