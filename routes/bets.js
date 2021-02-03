var express = require('express');
var router = express.Router();
var { config } = require('../config.js');
var mysql = require('mysql');

var conn = mysql.createConnection(config.mysql);

/* GET users listing. */
router.post('/', function(req, res, next) {

	var where

	const data = req.body

	const params = {
		account_id: data.account_id,
		filter: data.filter
	}

	if (!params.filter ||  params.filter === 'awaiting') where = 'status = "FUNDED"'
	if (params.filter === 'started') where = 'status = "STARTED"'
	if (params.filter === 'all') where = 'status = "FUNDED" OR status = "STARTED" OR status = "FINISHED"'
		
	conn.query(`
		select * from games 
		where ${where}`, 
		function(error, results, fields) 
	{
		if (error) {
			res.send({error: error})
			return
		}

		res.send(results);
	})


});



module.exports = router;
