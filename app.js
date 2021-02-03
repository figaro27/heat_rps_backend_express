var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var betsRouter = require('./routes/bets');
var createGameRouter = require('./routes/createGame');
var movesRouter = require('./routes/move');
var listenRouter = require('./routes/listen');
var startRouter = require('./routes/start');
var loadRouter = require('./routes/load');
var waitRouter = require('./routes/wait.js');
var paidRouter = require('./routes/paid.js');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(cors());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/bets', betsRouter);
app.use('/createGame', createGameRouter);
app.use('/move', movesRouter);
app.use('/listen', listenRouter);
app.use('/start', startRouter);
app.use('/load', loadRouter);
app.use('/wait', waitRouter);
app.use('/paid', paidRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
